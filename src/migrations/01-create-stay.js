'use strict';
module.exports = {
	up: function(queryInterface, Sequelize) {
		return queryInterface.createTable('stay', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER
			},
			eta: {
				type: Sequelize.DATE
			},
      arrival: {
			  type: Sequelize.DATE
      },
      departure: {
			  type: Sequelize.DATE
      },
			createdAt: {
				allowNull: false,
				type: Sequelize.DATE
			},
			updatedAt: {
				allowNull: false,
				type: Sequelize.DATE
			}
		});
	},
	down: function(queryInterface) {
		return queryInterface.dropTable('stay');
	}
};