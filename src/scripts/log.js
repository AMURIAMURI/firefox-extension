let logg;

/*
months.long.1=January
months.long.2=February
months.long.3=March
months.long.4=April
months.long.5=May
months.long.6=June
months.long.7=July
months.long.8=August
months.long.9=September
months.long.10=October
months.long.11=November
months.long.12=December
days.long.1=Sunday
days.long.2=Monday
days.long.3=Tuesday
days.long.4=Wednesday
days.long.5=Thursday
days.long.6=Friday
days.long.7=Saturday
timeformat=HH:nn:ss:zzz mmm dd, yyyy
*/

// TODO: i18n
let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

document.addEventListener("DOMContentLoaded", function() {
  browser.runtime.getBackgroundPage().then((page) => {
    logg = page.getLogg();
    console.log("logg active is " + logg.active);
    if (logg.active) {
      $("#onOff").prop("checked", true);
      renderLog();
    }
    else {
      $("#onOff").prop("checked", false);
      $("#spinnerRow").hide();
      $("#logRow").show();
    }
  });
});

$("#onOff").on("click", () => {
  let onOff = $("#onOff").prop("checked");
  console.log("user changed logging to " + onOff);
  browser.runtime.getBackgroundPage().then((page) => {
    page.ignoreNextWrite(); // Don't propagate changes the PAC script
    setLogging(500, onOff).then(() => {
      if (!onOff) {
        logg.active = false;
        logg.clear();
        renderLog();
      }
      else logg.active = true;
      getAllSettings().then((s) => console.log(s));
    });
  });
});

$("#okBtn1,#okBtn2").on("click", () => {
  location.href = "/proxies.html";
});

$("#clearBtn1,#clearBtn2").on("click", () => {
  logg.clear();
  renderLog();
});

$("#refreshBtn1,#refreshBtn2").on("click", () => {
  renderLog();
});

function renderLog() {
  let rows = [];
  for (let i=0; i<logg.length; i++) {
    let item = logg.item(i), pattern;
    if (item.matchedPattern) {
      pattern = item.matchedPattern == USE_PROXY_FOR_ALL_URLS ? "Use proxy for all URLs" :
        item.matchedPattern.pattern;
    }
    else pattern = "No matches";

		// Build a row for this log entry
		let row = document.createElement("tr");
		row.setAttribute("class", item.matchedPattern ? "success" : "secondary");
		let cell1 = document.createElement("td");
		row.appendChild(cell1);
		let a1 = document.createElement("a");
		cell1.appendChild(a1);
		a1.setAttribute("href", item.url);
		a1.setAttribute("target", "_blank");
		a1.appendChild(document.createTextNode(item.url));
		let cell2 = document.createElement("td");
		row.appendChild(cell2);
		cell2.appendChild(document.createTextNode(item.proxySetting ? item.proxySetting.title : "No matches"));
		let cell3 = document.createElement("td");
		row.appendChild(cell3);
		cell3.style.backgroundColor = item.proxySetting ? item.proxySetting.color : "blue";
		cell3.setAttribute("class", "fp-color-blob-log");
		let cell4 = document.createElement("td");
		row.appendChild(cell4);
		cell4.appendChild(document.createTextNode(item.proxySetting ? item.proxySetting.address : "No matches"));
		let cell5 = document.createElement("td");
		row.appendChild(cell5);
		cell5.appendChild(document.createTextNode(pattern));
		let cell6 = document.createElement("td");
		row.appendChild(cell6);
		cell6.appendChild(document.createTextNode(format(item.timestamp)));
    rows.push(row);
  }

	let parent = document.getElementById("rows");
	[...parent.childNodes].forEach(el => el.remove())
	rows.forEach(row => parent.appendChild(row));
  $("#spinnerRow").hide();
  $("#logRow").show();
}

// Thanks for the inspiration, Tor2k (http://www.codeproject.com/jscript/dateformat.asp)
function format(d) {
  d = new Date(d);
  if (!d.valueOf())
    return ' ';
  var self = this;
  return "HH:nn:ss:zzz".replace(/yyyy|mmmm|mmm|mm|dddd|ddd|dd|hh|HH|nn|ss|zzz|a\/p/gi,
    function($1) {
      switch ($1) {
        case 'yyyy': return d.getFullYear();
        case 'mmmm': return months[d.getMonth()];
        case 'mmm':  return months[d.getMonth()].substr(0, 3);
        case 'mm':   return zf((d.getMonth() + 1), 2);
        case 'dddd': return days[d.getDay()];
        case 'ddd':  return days[d.getDay()].substr(0, 3);
        case 'dd':   return zf(d.getDate(), 2);
        case 'hh':   return zf(((h = d.getHours() % 12) ? h : 12), 2);
        case 'HH':   return zf(d.getHours(), 2);
        case 'nn':   return zf(d.getMinutes(), 2);
        case 'ss':   return zf(d.getSeconds(), 2);
        case 'zzz':  return zf(d.getMilliseconds(), 3);
        case 'a/p':  return d.getHours() < 12 ? 'AM' : 'PM';
      }
    }
  );
  // My own zero-fill fcn, not Tor 2k's. Assumes (n==2 || n == 3) && c<=n.
  function zf(c, n) { c=""+c; return c.length == 1 ? (n==2?'0'+c:'00'+c) : (c.length == 2 ? (n==2?c:'0'+c) : c); }
}