function mapSingleUser(src) {
    return {
        id: src.id,
        displayName: src.displayname,
        username: src.username,
        createStamp: src.createstamp,
        updateStamp: src.updatestamp,
        enabled: src.enabled      
    }
}

function createSalt() {
    return Math.random().toString(36).substring(2, 15) + 
            Math.random().toString(36).substring(2, 15) + 
            Math.random().toString(36).substring(2, 15);
}

function hashPassword(password, salt) {
    const crypto = require('crypto');
    const secret = 'abcdefg';
    const hash = crypto.createHmac('sha256', secret)
               .update(salt + "::" + password)
               .digest('hex');
    return hash;
}

module.exports = {
    list: async function(pool) { 
        var users = await pool.query("select * from users");
        var results = users.map(user => mapSingleUser(user) );
        return results;
    },

    create: async function(pool, displayName, username, password) {
        var salt = createSalt();
        var hashedPassword = hashPassword(password, salt);

        //Check if user exists
        var user = await pool.query("select * from users where username=?", username);
        if (user.length > 0) {
            return null;
        }

        //Create the user
        var result = await pool.query(
            "INSERT INTO users (username, password, passwordsalt, displayname, enabled, createstamp, updatestamp) values (?, ?, ?, ?, 1, now(), now())",
            [username, hashedPassword, salt, displayName]);
        
        if (result.affectedRows == 1) {
            var newId = result.insertId;
            var newRow = await this.get(pool, newId);
            return newRow;
        }
        return null;
    },
    
    get: async function(pool, id) {
        var user = await pool.query("select * from users where id=?", id);
        if (user.length > 0) {
            return mapSingleUser(user[0]);
        } 
        return null;
    },

    update: async function(pool, userId, displayName, enabled) {
        var result = await pool.query(
            "update users set displayname=?, enabled=?, updatestamp=now() where id=?",
            [displayName, (enabled?"1":"0"), userId]);
        
        if (result.affectedRows == 1) {
            var newRow = await this.get(pool, userId);
            return newRow;
        }
        return null;
    },

    resetPassword: async function(pool, userId, newPassword) {
        var salt = createSalt();
        var hashedPassword = hashPassword(newPassword, salt);    
        var result = await pool.query(
            "update users set password=?, passwordsalt=?, updatestamp=now() where id=?",
            [hashedPassword, salt, userId]);
        
        if (result.affectedRows == 1) {
            var newRow = await this.get(pool, userId);
            return newRow;
        }
        return null;
    },

    login: async function(pool, username, password) {
        var user = await pool.query("select * from users where enabled=1 and username=?", username);
        if (user.length > 0) {
            var salt = user[0].passwordsalt;
            var dbPassword = user[0].password;

            //test password
            var testHash = hashPassword(password, salt);
            if (testHash == dbPassword) {
                return mapSingleUser(user[0]);
            }
            return null;            
        } 
        return null;
    },


    delete: async function(pool, userId) {
        var result = await pool.query("update users set enabled=0, updatestamp=now() where id=?", userId);
        
        if (result.affectedRows == 1) {
            var newRow = await this.get(pool, userId);
            return newRow;
        }
        return null;    
    }

};