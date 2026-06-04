import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import bcrypt from 'bcrypt';
import { User } from '../models';

const rl = createInterface({ input: stdin, output: stdout });

const handle = await rl.question('Username: ');
const password = await rl.question('Password: ');
rl.close();

if (!handle || !password) {
  console.log('Username and password are required');
  process.exit(1);
}

const hashedPassword = await bcrypt.hash(password, 15);

User.build({ handle, password: hashedPassword }).save().then((user) => {
  console.log('User created with id ' + user.id);
  process.exit(0);
}).catch((err) => {
  console.log(err);
  process.exit(1);
});
