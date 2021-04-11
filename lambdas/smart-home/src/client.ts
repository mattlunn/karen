import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core';
import fetch from 'cross-fetch';

export default new ApolloClient({
  link: new HttpLink({
    uri: `https://${process.env.KAREN_HOST}/graphql`,
    headers: {
      Authorization: `Bearer ${process.env.KAREN_AUTH_TOKEN}`
    },
    fetch
  }),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: 'no-cache'
    }
  }
});