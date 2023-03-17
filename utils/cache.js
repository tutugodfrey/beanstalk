'use strict';

module.exports = class Cache {
    constructor(app) {
        this.memory = [];
        this.logging = app.locals.config.app.logging;
    }

    log(msg) {
        if (this.logging) {
            console.log("Cache[" + this.memory.length +"] - " + msg);
        }
    }
        
    async put(key, value, ttlSeconds) {
        this.delete(key);
        var ots = {
            key,
            value,
            ttl: Date.now() + (ttlSeconds * 1000)
        };
        this.memory.push(ots);
        this.log("Item added to cache: " + key);
    }

    async get(key) {
        var currentTime = Date.now();
        var result = this.memory.find((obj) => {
            //Has same key and not expired
            return (obj.key == key) && (obj.ttl > currentTime);
        });
        if ((result === undefined) || (result == null)) {
            this.log("Cache miss on: " + key);
            return null;
        }
        this.log("Cache hit on: " + key);
        return result.value;
    }

    async delete(key) {
        var result = this.memory.find((obj) => {
            return (obj.key == key);
        });
        if ((result !== undefined) && (result != null)) {
            this.memory = this.memory.filter((obj) => {
                return (key != obj.key);
            });
            this.log("Cache delete on: " + key);
        } else {
            this.log(key + " not found in cache on delete"); 
        }
    }

    validateCache() {
        setImmediate(this.validateCacheAct, this);
        this.log("Cache management requested");
    }

    validateCacheAct(cacheProvider) {
        cacheProvider.log("Cache management running");
        var currentTime = Date.now();
        cacheProvider.memory = cacheProvider.memory.filter((obj) => {
            return obj.ttl > currentTime;
        });
        cacheProvider.log("Cache management done");
    }
}