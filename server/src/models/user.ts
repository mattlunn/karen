import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, NonAttribute, CreationOptional, Op } from 'sequelize';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare public id: CreationOptional<number>;
  declare public handle: string;
  declare public password: string;
  declare public email: string;
  declare public mobileNumber: string | null;
  declare public device: string | null;
  declare public pushoverToken: string | null;
  declare public createdAt: Date;
  declare public updatedAt: Date;

  get avatar(): NonAttribute<string> {
    const md5Hash = createHash('md5').update(this.get('email')).digest('hex');

    return `https://www.gravatar.com/avatar/${md5Hash}?s=32&d=identicon`;
  }

  static async findByCredentials(handle: string, password: string) {
    const user = await this.findOne({
      where: {
        handle: handle
      }
    });
  
    if (user && bcrypt.compareSync(password, user.password)) {
      return user;
    }

    return Promise.reject();
  }

  static findByHandles(handles: string[]) {
    return this.findAll({
      where: {
        handle: handles
      }
    });
  }

  static findAllById(ids: number[]) {
    return this.findAll({
      where: {
        id: ids
      }
    });
  }

  static getThoseWithPushoverToken() {
    return this.findAll({
      where: {
        pushoverToken: {
          [Op.not]: null
        }
      }
    });
  }
}

export default function (sequelize: Sequelize) {
  User.init({
    id: {
      type: DataTypes.NUMBER,
      allowNull: false,
      unique: true,
      primaryKey: true,
      autoIncrement: true
    },
    handle: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    device: {
      type: DataTypes.STRING,
      allowNull: true
    },
    pushoverToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'user'
  });
}