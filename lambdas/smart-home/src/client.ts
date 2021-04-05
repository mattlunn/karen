import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core';
import fetch from 'cross-fetch';

export default new ApolloClient({
  link: new HttpLink({
    uri: `https://${process.env.GRAPHQL_HOST}/graphql`,
    headers: {
      Authorization: `Bearer ${process.env.GRAPHQL_AUTH_TOKEN}`
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