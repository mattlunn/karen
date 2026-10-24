import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, NonAttribute, CreationOptional } from 'sequelize';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { Stay } from './stay';

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

  static async getUsersAtHome(): Promise<User[]> {
    const [currentStays, allUsers] = await Promise.all([
      Stay.findCurrentStays(),
      this.findAll()
    ]);
    const homeUserIds = new Set(currentStays.map(s => s.userId));

    return allUsers.filter(u => homeUserIds.has(u.id));
  }

  static async getAbsentUsers(): Promise<User[]> {
    const [currentStays, allUsers] = await Promise.all([
      Stay.findCurrentStays(),
      this.findAll()
    ]);
    const homeUserIds = new Set(currentStays.map(s => s.userId));

    return allUsers.filter(u => !homeUserIds.has(u.id));
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
      allowNull: true,
      defaultValue: null
    },
    device: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    pushoverToken: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    createdAt: {
      type: DataTypes.DATE(3),
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE(3),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'user'
  });
}