function mapSingleCategory(src) {
    return {
        id: src.id,
        name: src.name,
        createStamp: src.createstamp,
        updateStamp: src.updatestamp,
        createdBy: {
            id: src.createdby,
            name: src.displayname
        }
    }
}

const baseQuery = "select c.id, c.name, c.createstamp, c.updatestamp, c.createdby, u.username, u.password, u.passwordsalt, u.displayname, u.enabled from categories c inner join users u on c.createdby = u.id";

module.exports = {
    list: async function(pool) { 
        var categories = await pool.query(baseQuery);
        var results = categories.map(category => mapSingleCategory(category) );
        return results;
    },

    create: async function(pool, name, createdById) {
        //Check if exists
        var category = await pool.query("select * from categories where name=?", name);
        if (category.length > 0) {
            return null;
        }

        //Create the user
        var result = await pool.query(
            "INSERT INTO categories (name, createdby, createstamp, updatestamp) values (?, ?, now(), now())",
            [name, createdById]);
        
        if (result.affectedRows == 1) {
            var newId = result.insertId;
            category = await this.get(pool, newId);
            return category;
        }
        return null;
    },
    
    get: async function(pool, id) {
        var category = await pool.query(baseQuery + " where c.id=?", id);
        if (category.length > 0) {
            return mapSingleCategory(category[0]);
        } 
        return null;
    },

    update: async function(pool, id, name) {
        var result = await pool.query(
            "update categories set name=?, updatestamp=now() where id=?",
            [name, id]);
        
        if (result.affectedRows == 1) {
            var newRow = await this.get(pool, id);
            return newRow;
        }
        return null;
    },

    delete: async function(pool, id) {
        //Check if there are any photos in that category
        var count = await pool.query("select COALESCE(count(*), 0) as c from images where categoryid=?", id);
        if (count[0].c == 0) {
            var result = await pool.query("delete from categories where id=?", id);
            if (result.affectedRows == 1) {
                return true;
            }
        }
        return false;
    }
};