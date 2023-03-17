function mapSingleImage(src) {
    var catTags = [];
    if (src.tags != "") {
        catTags = src.tags.split(',');
    } 
    return {
        id: src.id,
        name: src.name,
        width: src.width,
        height: src.height,
        tags: catTags,
        size: src.size,
        extension: src.extension,
        createStamp: src.createstamp,
        updateStamp: src.updatestamp,
        createdBy: {
            id: src.createdby,
            name: src.displayname
        },
        category: {
            id: src.categoryid,
            name: src.catname
        }
    }
}

const baseQuery = `select i.id, i.name, i.width, i.height, i.tags, i.createstamp, i.updatestamp, i.createdby, i.size, i.extension, u.displayname, i.categoryid, c.name as catname
from images i inner join users u on i.createdby = u.id inner join categories c on i.categoryid = c.id`;

module.exports = {
    list: async function(pool) { 
        var images = await pool.query(baseQuery);
        var results = images.map(image => mapSingleImage(image) );
        return results;
    },

    listByCategory: async function(pool, categoryId) { 
        var images = await pool.query(baseQuery + " where i.categoryid = ?", categoryId);
        var results = images.map(image => mapSingleImage(image) );
        return results;
    },

    listByString: async function(pool, str) { 
        var searchStr = "%" + str + "%";
        var images = await pool.query(baseQuery + " where (i.name like ?) or (i.tags like ?) or (c.name like ?) or (u.displayname = ?) or (u.username = ?)",
            [searchStr, searchStr, searchStr, searchStr, searchStr]);
        var results = images.map(image => mapSingleImage(image) );
        return results;
    },

    create: async function(pool, name, width, height, tags, size, extension, createdById, categoryId) {
        //Check if exists in the category
        var image = await pool.query("select * from images where name=? and categoryid=?", [name, categoryId]);
        if (image.length > 0) {
            return null;
        }

        //Create the image
        var result = await pool.query(
            "INSERT INTO images (name, width, height, tags, size, extension, categoryid, createdby, createstamp, updatestamp) values (?, ?, ?, ?, ?, ?, ?, ?, now(), now())",
            [name, width, height, tags, size, extension, categoryId, createdById]);
        
        if (result.affectedRows == 1) {
            var newId = result.insertId;
            image = await this.get(pool, newId);
            return image;
        }
        return null;
    },
    
    get: async function(pool, id) {
        var image = await pool.query(baseQuery + " where i.id=?", id);
        if (image.length > 0) {
            return mapSingleImage(image[0]);
        } 
        return null;
    },

    update: async function(pool, id, name, width, height, tags, size, extension, categoryId) {
        var image = await this.get(pool, id);
        
        if (image.category.id != categoryId) {
            //If it's different category
            //Check if the name is used in the new category
            var image = await pool.query("select * from images where name=? and categoryid=?", [name, categoryId]);
            if (image.length > 0) {
                return null;
            }
        }
        
        var result = await pool.query(
            "update images set name=?, width=?, height=?, tags=?, categoryid=?, size=?, extension=?, updatestamp=now() where id=?",
            [name, width, height, tags, categoryId, size, extension, id]);
        
        if (result.affectedRows == 1) {
            image = await this.get(pool, id);
            return image;
        }
        return null;
    },

    delete: async function(pool, id) {
        var result = await pool.query("delete from images where id=?", id);
        if (result.affectedRows == 1) {
            return true;
        }
        return false;
    }
};