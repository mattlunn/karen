import React, { Component } from 'react';
import EtaPicker from './eta-picker';
import { connect } from 'react-redux';
import { getActiveModal } from '../../reducers/modal';
import {
  ETA_PICKER
} from '../../constants/modals';

function mapStateToProps(state) {
  return {
    activeModal: getActiveModal(state)
  };
}

@connect(mapStateToProps)
export default class Modals extends Component {
  constructor() {
    super();

    this.map = new Map();
    this.map.set(ETA_PICKER, EtaPicker);
  }

  render() {
    if (this.map.has(this.props.activeModal)) {
      const Component = this.map.get(this.props.activeModal);

      return (
        <div className="modal__backdrop">
          <div className="modal__container">
            <Component />
          </div>
        </div>
      );
    } else {
      return null;
    }
  }
}