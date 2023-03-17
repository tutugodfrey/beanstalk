
/* ensures a user exists and returns 401 */
module.exports = function (isAdmin = false) {
    return (req, res, next) => {
        if (res.locals.user == null) {
            res.sendStatus(401);
            console.log("INFO - Required User not found");
            return;
        }
        if (isAdmin) {
            if (res.locals.user.id != 1) {
                res.sendStatus(401);
                console.log("INFO - Required User not admin");
                return;
            }
        }
        console.log("Auth - Requried user found: " + res.locals.user.username);
        next();
    }
}