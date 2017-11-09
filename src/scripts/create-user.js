import prompt from 'prompt';
import bcrypt from 'bcrypt';
import { User } from '../models';

prompt.start();
prompt.get({
  properties: {
    handle: {
      description: 'Username',
      required: true
    },

    password: {
      description: 'Password',
      hidden: true,
      required: true,
      before: function (value) {
        return bcrypt.hashSync(value, 15);
      }
    }
  }
}, function (err, results) {
  if (err) {
    process.exit(1);
  } else {
    User.build(results).save().then((what) => {
      console.log('User created with id ' + what.id);

      process.exit(0);
    }).catch((err) => {
      console.log(err);
      process.exit(1);
    });
  }
});