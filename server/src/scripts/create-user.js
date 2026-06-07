import { createInterface } from 'readline/promises';
import bcrypt from 'bcrypt';
import { User } from '../models';

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const handle = await rl.question('Username: ');
    const password = await rl.question('Password: ');

    if (!handle || !password) {
      console.log('Username and password are required');
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 15);
    const user = await User.build({ handle, password: hashedPassword }).save();
    console.log('User created with id ' + user.id);
  } finally {
    rl.close();
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.log(err);
  process.exit(1);
});
