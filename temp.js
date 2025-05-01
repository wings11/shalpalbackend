const bcrypt = require('bcryptjs');
const password = 'shalpalshalpal'; // Replace with desired password
const hashedPassword = bcrypt.hashSync(password, 10);
console.log(hashedPassword);
