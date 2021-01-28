import React, { FC, useState } from 'react';
import * as EmailValidator from 'email-validator';
import { Grid, TextField, Button } from '@material-ui/core';

export interface LoginProps {
  loginWithMagic: (_email: string) => void;
  styles: string;
}

export const Login: FC<LoginProps> = props => {
  const { loginWithMagic, styles } = props;
  const [email, setEmail] = useState('');

  const validateEmail = EmailValidator.validate(email);

  const handleChange = event => {
    setEmail(event.target.value);
  };

  const handleSubmit = values => {
    const errors = { email: '' };
    if (!values.email) {
      errors.email = 'Required';
    }
    return errors;
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <Grid container alignItems="flex-end" className={styles}>
          <Grid item xs={12}>
            <TextField
              label={`Email`}
              name="email"
              aria-describedby="email"
              defaultValue={email}
              type="search"
              onChange={handleChange}
              required
              fullWidth
            />
          </Grid>
        </Grid>
      </form>

      <Grid container spacing={2} justifyContent="center">
        <Grid item style={{ marginTop: 16 }}>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={!validateEmail}
            onClick={() => loginWithMagic(email)}
          >
            LogIn / SignUp
          </Button>
        </Grid>
      </Grid>
    </>
  );
};
