
if (Meteor.isClient) {
  var progressNumTasks = 0, progressTasksCompleted = 0;

  Meteor.startup(function () {
    $("#excel").addClass("hidden");
  });

  var spinner = new Spinner();

  // counter starts at 0
  Session.setDefault("counter", 0);
  Session.setDefault("ASXResults", []);

  console.log(Template.hello);

  Template.hello.helpers({
    counter: function () {
      return Session.get("counter");
    },
    company: function () {
      return Session.get("ASXResults");
    },
    companyName: function () {
      return this["ticker"];
    },
    companyTicker: function () {
      return this["ticker"];
    },
    companyProp: function () {

      var props = _.map(this,
              function (val, key) {
                var obj = {};
                obj["key"] = key;
                obj["value"] = val;

                return obj;
              });

      return props;
    }
  });

  function updateProgress() {
    var progressBar = $("#progressBar")[0];        // increment the counter when button is clicked
    var percentage = ((progressTasksCompleted / progressNumTasks) * 100).toFixed(0);
    progressBar.style.width = "" + percentage + "%";
    progressBar.innerHTML = percentage + "% Complete.";
    if (progressTasksCompleted === progressNumTasks) {
      spinner.stop();
      $("#excel").removeClass("hidden");
    }
  }

  Template.hello.events({
    'click button': function () {
      Session.set("ASXResults", []);

      var tickerCodes = $('#tickercodes').val();
      console.log(tickerCodes);
      var tickersArray = [];
      if (tickerCodes !== null && tickerCodes.length > 1) {
        tickersArray = tickerCodes.split(",");
      } else {
        toastr["error"]("Enter a valid stock ticker");
      }
      var url, i;
      progressNumTasks = tickersArray.length * 2;
      progressTasksCompleted = 0;
      $("#excel").addClass("hidden");
      for (i = 0; i < tickersArray.length; i++) {
        spinner.spin(document.body);
        Meteor.call("getASXData",
                tickersArray[i],
                function (error, result) {
                  progressTasksCompleted++;
                  updateProgress();
                  if (error || !(!!result)) {
                    console.log(error);
                    toastr["error"]("There was an issue.");
                  } else {
                    var ticker = result[1];
                    result = result[0];
                    var newObj = {"ticker": ticker};
                    var html = $.parseHTML(result.content);
                    var responseJQuery = $(html);
                    var companyNameElem = responseJQuery.find("#company-information  h1")[0];
                    if (!!companyNameElem) {
                      toastr["success"]("Great success!");
                    } else {
                      toastr["warning"]("Strange result. Please check your ticker.");
                      return;
                    }
                    newObj.companyName = companyNameElem.innerText;
                    newObj.directors = responseJQuery.find("#directors tbody tr td")[0].innerText;
                    // loop through and add company information
                    var companyDetailsHeadings = responseJQuery.find(".company-details tr th");
                    var companyDetailsValues = responseJQuery.find(".company-details tr td");
                    for (var i = 0; i < companyDetailsHeadings.length; i++) {
                      newObj[companyDetailsHeadings[i].innerText] = companyDetailsValues[i].innerText;
                    }
                    // find our ticker's object in the session if it's there.
                    var ASXResults = Session.get("ASXResults") || [];
                    var sessionObj = _.findWhere(ASXResults, {"ticker": ticker}) || {};
                    ASXResults = _.without(ASXResults, sessionObj);

                    sessionObj = _.extend(sessionObj, newObj);
                    ASXResults.push(sessionObj);

                    Session.set("ASXResults", ASXResults);



                  }
                }
        );
        Meteor.call("getYahooFinanceData",
                tickersArray[i],
                function (error, result) {
                  progressTasksCompleted++;
                  updateProgress();
                  if (error || !(!!result)) {
                    console.log(error);
                    toastr["error"]("There was an issue.");
                  } else {
                    var ticker = result[1];
                    result = result[0];
                    var newObj = {"ticker": ticker};
                    var responseJSON = JSON.parse(result.content);
                    if (!!responseJSON) {
                      toastr["success"]("Yahoo!");
                      var value;
                      for (var key in responseJSON.query.results.stats) {

                        var tempval = responseJSON.query.results.stats[key];
                        if (typeof tempval === "object") {
                          if (tempval.content) {
                            value = tempval.content;
                          } else {
                            value = JSON.stringify(tempval);
                          }
                        } else {
                          value = tempval;
                        }
                        newObj[key] = value;
                      }
                      var ASXResults = Session.get("ASXResults") || [];
                      // find our ticker's object in the session if it's there.
                      var sessionObj = _.findWhere(ASXResults, {"ticker": ticker}) || {};
                      ASXResults = _.without(ASXResults, sessionObj);
                      sessionObj = _.extend(sessionObj, newObj);
                      ASXResults.push(sessionObj);

                      Session.set("ASXResults", ASXResults);
                    } else {
                      toastr["warning"]("Strange resultfrom yahoo. Please check your ticker.");
                      return;
                    }

                  }
                }
        );
      }
    },
    // ========= build a spreadsheet for download
    'click #excel': function () {

      var ASXResults = Session.get("ASXResults");
      if (!ASXResults || ASXResults.length === 0) {
        return;
      }
      // build up an array of column names from our first data item.
      var firstCompany = ASXResults[0],
              columns = [],
              i;
      for (i in firstCompany) {
        if (firstCompany.hasOwnProperty(i)) {
          columns.push({headertext: i, datafield: i, ishidden: false});
        }
      }

      var d = new Date();
      var t = d.toTimeString().substring(0, 8).replace(/:/g, "-"); // time component.
      var currentTimeString = "" + d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate() + "_" + t;
      // ==== create a link to download the spreadsheet
      var a = document.createElement("A");
      a.setAttribute("id", "downloadLink");


      a.setAttribute("href", $("#dvjson").btechco_excelexport({
        containerid: "dvjson"
        , datatype: $datatype.Json
        , dataset: ASXResults
        , returnUri: true
        , columns: columns

      }));
      a.innerHTML = "Download me";
      if (a.download === undefined) {
        $('#modalExcelDiv a#downloadLink').remove();
        a.setAttribute("download", "companyInfo_" + currentTimeString + ".xls");
        $('#modalExcelDiv').get(0).appendChild(a);
        $('#modalExcel').modal('show');
      } else {
        a.setAttribute("download", "companyInfo_" + currentTimeString + ".xls");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }



  });
}


if (Meteor.isServer) {
  Meteor.startup(function () {

  });
  Meteor.methods({getASXData: function (ticker) {
      try {
        var result = HTTP.get("http://www.asx.com.au/asx/research/companyInfo.do?by=asxCode&asxCode=" + ticker, null);
        return [result, ticker];
      } catch (e) {
        // Got a network error, time-out or HTTP error in the 400 or 500 range.
        return false;
      }
    }});
  Meteor.methods({getYahooFinanceData: function (ticker) {
      try {
        var result = HTTP.get("https://query.yahooapis.com/v1/public/yql?q=SELECT%20*%20FROM%20yahoo.finance.keystats%20WHERE%20symbol%3D'" + ticker + ".AX'&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=", null);
        return [result, ticker];
      } catch (e) {
        // Got a network error, time-out or HTTP error in the 400 or 500 range.
        return false;
      }
    }});
}
