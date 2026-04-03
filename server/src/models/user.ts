import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, NonAttribute, CreationOptional, Op } from 'sequelize';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import dayjs from '../dayjs';

export type UserRole = 'full' | 'guest';

export interface GuestSchedule {
  days: number[];
  startTime: string;
  endTime: string;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare public id: CreationOptional<number>;
  declare public handle: string;
  declare public password: string;
  declare public email: string;
  declare public mobileNumber: string | null;
  declare public device: string | null;
  declare public pushoverToken: string | null;
  declare public role: CreationOptional<UserRole>;
  declare public code: string | null;
  declare public validFrom: string | null;
  declare public validTo: string | null;
  declare public schedule: GuestSchedule | null;
  declare public createdAt: Date;
  declare public updatedAt: Date;

  get avatar(): NonAttribute<string> {
    const md5Hash = createHash('md5').update(this.get('email')).digest('hex');

    return `https://www.gravatar.com/avatar/${md5Hash}?s=32&d=identicon`;
  }

  isGuestCodeCurrentlyValid(): boolean {
    if (this.role !== 'guest') {
      return false;
    }

    const now = dayjs();
    const today = now.format('YYYY-MM-DD');

    if (this.validFrom && today < this.validFrom) {
      return false;
    }

    if (this.validTo && today > this.validTo) {
      return false;
    }

    if (this.schedule) {
      const currentDay = now.day();

      if (!this.schedule.days.includes(currentDay)) {
        return false;
      }

      const currentTime = now.format('HH:mm');

      if (currentTime < this.schedule.startTime || currentTime >= this.schedule.endTime) {
        return false;
      }
    }

    return true;
  }

  static async findByCredentials(handle: string, password: string) {
    const user = await this.findOne({
      where: {
        handle: handle,
        role: 'full'
      }
    });

    if (user && bcrypt.compareSync(password, user.password)) {
      return user;
    }

    return Promise.reject();
  }

  static findByCode(code: string) {
    return this.findOne({
      where: {
        role: 'guest',
        code
      }
    });
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
    role: {
      type: DataTypes.ENUM('full', 'guest'),
      allowNull: false,
      defaultValue: 'full'
    },
    code: {
      type: DataTypes.STRING(6),
      allowNull: true
    },
    validFrom: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    validTo: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    schedule: {
      type: DataTypes.JSON,
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