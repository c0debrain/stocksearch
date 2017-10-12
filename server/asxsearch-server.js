import yahooFinance from 'yahoo-finance';

  Meteor.methods({
    getASXData: function (ticker) {
      try {
        var resultJSON = HTTP.get("http://data.asx.com.au/data/1/company/" + ticker + "?fields=primary_share,latest_annual_reports,last_dividend,primary_share.indices", null);
        var directorsJSON = HTTP.get("http://data.asx.com.au/data/1/company/" + ticker + "/people");
        var result;
        try {
          result = resultJSON.data;
          var directorsData = directorsJSON.data;
          result.directors = directorsData.directors;
        } catch (e) {
          console.log("error parsing JSON for..." + ticker);
          //console.error(e);
          console.log("resultJSON was:");
          console.log(resultJSON);
          console.log("directorsJSON was:");
          console.log(directorsJSON);
        }
        return [result, ticker];
      } catch (e) {
        // Got a network error, time-out or HTTP error in the 400 or 500 range.
        return false;
      }
    }
  });
  Meteor.methods({
    getYahooFinanceData: function (ticker) {
        return new Promise((resolve, reject) => {
          yahooFinance.quote({
            symbol: `${ticker}.AX`,
            modules: ['summaryDetail']
          }, (err, result) => {
            if (err) {
              console.error(err);
              reject(err);
            }
            // console.log(result);
            resolve([result, ticker]);
          });
        });
    }
  });