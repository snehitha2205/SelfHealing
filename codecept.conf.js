const { setHeadlessWhen } = require('@codeceptjs/configure');

setHeadlessWhen(process.env.HEADLESS);

exports.config = {
  tests: './tests/*_test.js',
  output: './output',

  helpers: {
    Playwright: {
      url: 'http://localhost:3000',
      browser: 'chromium',
      show: false,
      waitForAction: 500,
      restart: false
    }
  },

  include: {
    I: './steps_file.js'
  }
};