const crypto = require('crypto');
const secret = 'abcdefg';

const salt = 'a2btbsdpaf67cx7xe9ic6m7r1kqsnacp';
const password = 'awstechshift';


const hash = crypto.createHmac('sha256', secret)
           .update(salt + "::" + password)
           .digest('hex');
console.log(hash);