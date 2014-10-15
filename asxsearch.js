
if (Meteor.isClient) {
  Meteor.startup(function () {
    $("#excel").addClass("hidden");
  });

  var spinner = new Spinner();
  // counter starts at 0
  Session.setDefault("counter", 0);
  Session.setDefault("ASXResults", []);


  Template.hello.helpers({
    counter: function () {
      return Session.get("counter");
    },
    company: function () {
      return Session.get("ASXResults");
    }
  });

  Template.hello.events({
    'click button': function () {
      // increment the counter when button is clicked
      Session.set("ASXResults", []);

      var tickerCodes = $('#tickercodes').val();
      console.log(tickerCodes);
      var tickersArray = [];
      if (tickerCodes !== null && tickerCodes.length > 1) {
        tickersArray = tickerCodes.split(",");
      } else {
        toastr["error"]("Enter a valid stock ticker");
      }
      var url;
      for (var i = 0; i < tickersArray.length; i++) {
        spinner.spin(document.body);
        Meteor.call("getASXData",
                tickersArray[i],
                function (error, result) {
                  spinner.stop();
                  if (error || !(!!result)) {
                    console.log(error);
                    toastr["error"]("There was an issue.");
                  } else {
                    var newObj = {};
                    var html = $.parseHTML(result.content);
                    var responseJQuery = $(html);
                    var companyNameElem = responseJQuery.find("#company-information  h1")[0];
                    if (!!companyNameElem) {
                      toastr["success"]("Great success!");
                      $("#excel").removeClass("hidden");
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
                    // Hopefully by now we have the issuer code
                    var ticker = newObj["Issuer Code"];
                    // index it in our session by ticker.
                    var ASXResults = Session.get("ASXResults");
                    ASXResults.push(newObj);
                    Session.set("ASXResults", ASXResults);



                  }
                }
        );
      }
    },
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
        return result;
      } catch (e) {
        // Got a network error, time-out or HTTP error in the 400 or 500 range.
        return false;
      }
    }});
}
