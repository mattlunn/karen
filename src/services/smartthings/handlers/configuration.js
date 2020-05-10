export default function (data) {
  if (data.configurationData.phase === 'INITIALIZE') {
    return {
      configurationData: {
        initialize: {
          name: 'Karen',
          description: 'I care',
          id: 'app',
          permissions: ['r:devices:*', 'w:devices:*', 'x:devices:*', 'i:deviceprofiles', 'r:locations:*'],
          firstPageId: '1'
        }
      }
    };
  } else {
    return {
      configurationData: {
        page: {
          pageId: '1',
          name: 'Setup',
          complete: true,
          nextPageId: null,
          previousPageId: null,
          sections: []
        }
      }
    };
  }
}