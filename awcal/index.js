var authorizeButton = $("#authorize_button");
var signoutButton = $("#signout_button");
var calendarSelect = $("#cal_select");
var calendarIframe = $("#cal_iframe");
var calendars = undefined;

function printwill() {
  var event = {
    summary: "Google I/O 2015",
    location: "800 Howard St., San Francisco, CA 94103",
    description: "A chance to hear more about Google's developer products.",
    start: {
      dateTime: "2019-06-08T17:00:00-07:00",
      timeZone: "America/Los_Angeles"
    },
    end: {
      dateTime: "2019-06-08T17:00:00-07:00",
      timeZone: "America/Los_Angeles"
    },
    recurrence: ["RRULE:FREQ=DAILY;COUNT=2"],
    attendees: [
      {
        email: "lpage@example.com"
      },
      {
        email: "sbrin@example.com"
      }
    ],
    reminders: {
      useDefault: false,
      overrides: [
        {
          method: "email",
          minutes: 24 * 60
        },
        {
          method: "popup",
          minutes: 10
        }
      ]
    }
  };

  var request = gapi.client.calendar.events.insert({
    calendarId: "primary",
    resource: event
  });

  console.log("will exec");
  request.execute(function(event) {
    appendPre("Event created: " + event.htmlLink);
  });
  console.log("execed");
}

function loadSelectedCal() {
  if (calendars) {
    var cal = calendars[calendarSelect.prop("selectedIndex")];
    calendarIframe.attr(
      "src",
      "https://calendar.google.com/calendar/embed?src=" + cal.id
    );
  }
}

function beginApp() {
  authorizeButton.hide();
  signoutButton.show();

  gapi.client.calendar.calendarList
    .list({
      minAccessRol: "writer",
      maxResults: 250
    })
    .then(function(response) {
      calendarSelect.empty();

      calendars = response.result.items;
      for (i = 0; i < calendars.length; i++) {
        var item = calendars[i];
        calendarSelect.append(
          $("<option></option>")
            .attr("value", "")
            .text(item.summary)
        );
      }

      loadSelectedCal();
    });
}

function closeApp() {
  calendars = undefined;

  calendarSelect.empty();
  calendarSelect.append(
    $("<option></option>")
      .attr("value", "")
      .text("Sign in first!")
  );

  calendarIframe.attr("src", "about:blank");

  authorizeButton.show();
  signoutButton.hide();
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    beginApp();
  } else {
    closeApp();
  }
}

$(document).ready(
  gapi.load("client:auth2", function() {
    // Client ID and API key from the Developer Console
    var CLIENT_ID =
      "273322583785-7onemib94f54kievfcm4if2gqbs7fl9e.apps.googleusercontent.com";
    var API_KEY = "AIzaSyAHYWZYeX3wpIf1KCEEXt0gK0LHX5bCFU4";

    // Array of API discovery doc URLs for APIs used by the quickstart
    var DISCOVERY_DOCS = [
      "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"
    ];

    // Authorization scopes required by the API; multiple scopes can be
    // included, separated by spaces.
    var SCOPES = "https://www.googleapis.com/auth/calendar";

    gapi.client
      .init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
      })
      .then(
        function() {
          // Regardless of the initial sign-in state, set "close" first
          closeApp();

          // Listen for sign-in state changes.
          gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

          // Handle the initial sign-in state.
          updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
          authorizeButton.click(function(event) {
            gapi.auth2.getAuthInstance().signIn();
          });
          signoutButton.click(function(event) {
            gapi.auth2.getAuthInstance().signOut();
          });
          calendarSelect.change(loadSelectedCal);
        },
        function(error) {
          console.log(error);
        }
      );
  })
);
