import React, { Component } from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import { graphql } from '@apollo/client/react/hoc';
import gql from 'graphql-tag';
import { Link } from 'react-router-dom';
import classnames from 'classnames';
import HeatingHistory from '../history/heating-history';
import LightingHistory from '../history/lighting-history';

class History extends Component {
  render() {
    const { lights = [], thermostats = [] } = this.props;
    const params = new URLSearchParams(this.props.location.search);
    const tab = params.get('tab') || 'heating';

    return (
      <div>
        <Header />
        <div>
          <SideBar hideOnMobile />
          <div className='body body--with-padding'>
            <ul className="tabs">
              <li className={classnames('tab', tab === 'heating' && 'tab--selected')}><h2><Link to="/history/?tab=heating">Heating</Link></h2></li>
              <li className={classnames('tab', tab === 'lighting' && 'tab--selected')}><h2><Link to="/history/?tab=lighting">Lighting</Link></h2></li>
            </ul>

            {tab === 'heating' && thermostats.map(thermostat => <HeatingHistory key={thermostat.id} id={thermostat.id} name={thermostat.name} />)}
            {tab === 'lighting' && lights.map(light => <LightingHistory key={light.id} id={light.id} name={light.name} />)}
          </div>
        </div>
      </div>
    );
  }
}

export default graphql(gql`{
  getLighting {
    lights {
      id,
      name
    }
  }

  getHeating {
    thermostats {
      id,
      name
    }
  }
}`, {
  props({ data }) {
    const sort = (arr) => arr.toSorted((a, b) => a.name.localeCompare(b.name));

    if (data.loading) {
      return {};
    }

    return {
      lights: sort(data.getLighting.lights),
      thermostats: sort(data.getHeating.thermostats)
    };
  }
})(History);