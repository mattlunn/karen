import React, { Component } from 'react';
import { connect } from 'react-redux';
import { attemptLogin } from '../../actions/user';
import { getIsLoggingIn, getLoginError } from '../../reducers/user';

function mapStateToProps(state) {
  return {
    isLoggingIn: getIsLoggingIn(state.user),
    loginError: getLoginError(state.user)
  };
}

class Home extends Component {
  constructor() {
    super();

    this.state = {};
  }

  handleLogin = (e) => {
    e.preventDefault();

    this.props.attemptLogin(this.state.username, this.state.password);
  };

  updateField = (e) => {
    this.setState({
      [e.target.name]: e.target.value
    });
  };

  render() {
    return (
      <div>
        <div className="login__panel">
          <form>
            <p>
              <label>Username</label>
              <input type="text" name="username" onChange={this.updateField} />
            </p>
            <p>
              <label>Password</label>
              <input type="password" name="password" onChange={this.updateField} />
            </p>
            <p>
              <input type="submit" value="Submit" onClick={this.handleLogin} disabled={this.props.isLoggingIn} />
            </p>
          </form>
        </div>
      </div>
    );
  }
}

export default connect(mapStateToProps, {
  attemptLogin
})(Home);