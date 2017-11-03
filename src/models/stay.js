import Sequelize from 'sequelize';

export default function (sequelize) {
	const stay = sequelize.define('stay', {
    eta: {
      type: Sequelize.DATE
    },
    arrival: {
      type: Sequelize.DATE
    },
    departure: {
      type: Sequelize.DATE
    },
	});

	return stay;
};