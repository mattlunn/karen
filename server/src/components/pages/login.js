import React, { useState } from 'react';
import { applicationFetch } from '../../helpers/fetch';
import { useNavigate } from 'react-router-dom';
import styles from './login.module.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const navigate = useNavigate();

  const attemptLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);

    const res = await applicationFetch('/authentication/login', {
      username,
      password
    });

    if (res.ok) {
      navigate('/');
    } else {
      setIsLoggingIn(false);
    }
  };

  return (
    <div>
      <div className={styles.panel}>
        <form>
          <p>
            <label>Username</label>
            <input type="text" name="username" onChange={(e) => setUsername(e.target.value)}/>
          </p>
          <p>
            <label>Password</label>
            <input type="password" name="password" onChange={(e) => setPassword(e.target.value)}/>
          </p>
          <p>
            <input type="submit" value="Submit" onClick={attemptLogin} disabled={isLoggingIn} />
          </p>
        </form>
      </div>
    </div>
  );
}