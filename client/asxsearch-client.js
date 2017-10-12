import Spinner from './spin.min';

var progressNumTasks = 0,
  progressTasksCompleted = 0,
  browserOutput = false,
  browserOutputDependency = new Tracker.Dependency,
  getBrowserOutput = function () {
    browserOutputDependency.depend()
    return browserOutput;
  }, setbrowserOutput = function (w) {
    browserOutput = w;
    browserOutputDependency.changed();
  },
  spinner = new Spinner();


Meteor.startup(function () {
  $("#excel").addClass("hidden");
});


// counter starts at 0
Session.setDefault("counter", 0);
Session.setDefault("ASXResults", []);

Template.hello.helpers({
  counter: function () {
    return Session.get("counter");
  },
  browserOutput: function () {
    return getBrowserOutput();
  },
  company: function () {
    return Session.get("ASXResults");
  },
  companyName: function () {
    return this["companyName"];
  },
  companyTicker: function () {
    return this["ticker"];
  },
  companyProp: function () {

    function renderObjectToHTMLTable(val) {
      var tableHTML = '<table class="table table-striped table-bordered"><thead><tr>';
      var keys = _.keys(val);
      _.each(keys, function (element, index, list) {
        tableHTML += '<td>' + element + '</td>';
      }, this);
      tableHTML += '</tr></thead>';
      tableHTML += '<tbody>';
      _.each(keys, function (element, index, list) {
        var renderItem = val[element];
        if (_.isArray(renderItem)) {
          renderItem = renderArrayToHTMLTable(val[element]);
        } else if (_.isObject(renderItem)) {
          renderItem = renderObjectToHTMLTable(val[element]);
        }
        tableHTML += '<td>' + renderItem + '</td>';
      }, this);
      tableHTML += '</tbody>';
      tableHTML += '</table>';
      return tableHTML;
    }

    function renderArrayToHTMLTable(val) {
      if (val.length > 0) {
        var columnNames;
        var tableHTML = '<table class="table table-striped table-bordered">';
        if (_.isObject(val[0])) {
          tableHTML += "<thead><tr>";
          columnNames = _.keys(val[0]);

          _.each(columnNames, function (element, index, list) {
            tableHTML += '<th>' + element + '</th>';
          }, this);
          tableHTML += "</tr></thead>";
          tableHTML += '<tbody>';
          _.each(val, function (obj) { // for each object in our array
            tableHTML += "<tr>";
            _.each(columnNames, function (colName) {
              tableHTML += "<td>" + this[colName] + "</td>";
            }, obj);
            tableHTML += "</tr>";
          }, this);
          tableHTML += '</tbody>';
        } else {
          // we have an array of non-object items. Just print them in one row per item.
          tableHTML += '<tbody>';
          _.each(val, function (obj) { // for each object in our array
            tableHTML += "<tr>";
            tableHTML += "<td>" + obj + "</td>";
            tableHTML += "</tr>";
          }, this);
          tableHTML += '</tbody>';
        }
        tableHTML += '</table>';
        return tableHTML;
      }
      return null;
    }


    var props = _.map(this,
      function (val, key) {
        var obj = {};
        obj["key"] = key;
        var tableHTML;
        if (_.isArray(val)) {
          // we have an array of objects. Get the keys from the first one.
          tableHTML = renderArrayToHTMLTable(val);
          obj["value"] = tableHTML;
        } else if (_.isObject(val)) {
          tableHTML = renderObjectToHTMLTable(val);
          obj["value"] = tableHTML;
        } else {
          obj["value"] = val;
        }

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
  'change #browserOutput': function (evt) {
    setbrowserOutput(evt.target.checked);
  },
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
            toastr["error"]("There was an issue. (" + tickersArray[i] + ")");
          } else {
            var ticker = result[1];
            result = result[0];
            var newObj = { "ticker": ticker };

            var companyName = result.name_full;
            if (!!companyName) {
              toastr["success"]("From ASX for " + ticker, "Great success!");
            } else {
              toastr["warning"]("From ASX for: " + ticker, "Strange result");
              return;
            }
            newObj.companyName = companyName;

            _.extend(newObj, result);
            // get the primary share info out
            var primaryShareInfo = newObj["primary_share"];
            newObj = _.omit(newObj, "primary_share");
            // add the primary share stuff to the top-level object
            newObj = _.extend(newObj, primaryShareInfo);

            updateSessionObjectForTicker(newObj, ticker); // update the session object
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
            toastr["error"]("There was an issue with Yahoo!. (" + tickersArray[i] + ")");

          } else {
            var ticker = result[1];
            result = result[0];
            var newObj = { "ticker": ticker };
            if (!!result.summaryDetail) {
              toastr["success"]("Yahoo! gave us " + ticker, "Great Success!");
              var value;
              for (var key in result.summaryDetail) {

                var tempval = result.summaryDetail[key];
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
              updateSessionObjectForTicker(newObj, ticker); // update our session object.
            } else {
              toastr["warning"]("From Yahoo! for: " + ticker, "Strange result");
              return;
            }

          }
        }
      );
    }
  },
  // ========= build a spreadsheet for download
  'click #excel': function () {
    if (confirm("I don't think the spreadsheets are working too well; columns headings are not lining up and don't match the data.")) {
      var ASXResults = Session.get("ASXResults");
      if (!ASXResults || ASXResults.length === 0) {
        return;
      }
      // build up an array of column names from our first data item.
      var columns = {}, i;
      for (i = 0; i < ASXResults.length; i++) {
        columns = _.extend(columns, ASXResults[i]);
      }
      columns = _.keys(columns);
      columns = _.map(columns, function (a, b) {
        return { headertext: a, datafield: a, ishidden: false };
      })


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
  }


});
function updateSessionObjectForTicker(newObj, ticker) {
  // find our ticker's object in the session if it's there.
  var ASXResults = Session.get("ASXResults") || [];
  var sessionObj = _.findWhere(ASXResults, { "ticker": ticker }) || {};
  ASXResults = _.without(ASXResults, sessionObj);

  sessionObj = _.extend(sessionObj, newObj);
  ASXResults.push(sessionObj);

  Session.set("ASXResults", ASXResults);
}