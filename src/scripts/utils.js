class Utils {

  // Nicer version of https://stackoverflow.com/a/39810769
  // Localize data-localize attributes so that textContent of the node is set to
  // the localized value of the data-localize attribute. It must have the __MSG_foo__ pattern.
  // Do the same for attributes but replace them in-place (not textContent). This is
  // to support attributes like title in <a title="localize me">, etc.

  static localizeHtmlPage() {

    let localizeRegExp = new RegExp("__MSG_\S+__", "g");
    function replace_i18n(elemOrAttr, strToLocalize, isAttribute) {
      // Find all __MSG_xxxxx__ strings and replace
      let localizedStr = strToLocalize.replace(/__MSG_\S+__/gi,
        function(z) {
          // If the message is missing, chrome.i18n.getMessage() returns an empty string ('').
          // If the format of the getMessage() call is wrong — for example,
          // messageName is not a string or the substitutions array has more than 9 elements
          // this method returns undefined.
          return chrome.i18n.getMessage(z.substring(6, z.length-2)) || "";
        });

      if (strToLocalize == localizedStr) {
				console.warn(`Missing localization for ${strToLocalize}. Using hard-coded default.`);
			}
			else {
				// Replace content
        if (isAttribute) {
          elemOrAttr.value = localizedStr;
        }
        else {
          // Find the 1st child text node to replace. This assumes there's already
          // fall-back translation text in the HTML. But it also handles nested elements like:
          // <a href="/add-edit-proxy.html" data-localize="__MSG_proxy_add__">
          //   <i class="fa fa-1point8x fa-plus-circle fp-orange"></i> Add
          // </a>
          let found = false;
          for (let idx=0; !found && idx<elemOrAttr.childNodes.length; idx++) {
            let childNode = elemOrAttr.childNodes[idx];
            if (childNode.nodeType == Node.TEXT_NODE) {
              childNode.textContent = localizedStr;
              found = true;
            }
          }
					if (!found) {
						// OK, there's no fall-back translation in the HTML.
						// Just append the text as a new text node at the end of the current node.
						elemOrAttr.appendChild(document.createTextNode(localizedStr));
          }
					// Remove the data-localize attr to remove DOM clutter
					// We can also "inspect element" and if this attribute is missing, we know
					// the localization has been processed. Note that "view source" shows original content,
					// not our replaced content. Don't rely on it.
					elemOrAttr.removeAttribute("data-localize");
        }
      }
    }

    // Localize elems with data-localize attributes
    let elems = document.querySelectorAll("*[data-localize]");
    elems.forEach(elem => {
      let strToLocalize = elem.dataset.localize;
      replace_i18n(elem, strToLocalize, false);
    });

    // Now attributes. Add others to the comma-separated list if needed.
    elems = document.querySelectorAll("*[title^=__MSG_], *[href^=__MSG_]");
    elems.forEach(elem => {
      // Iterate over all attributes of this element, finding the attribute(s)
      // that need localizing
      for (let idx = 0; idx < elem.attributes.length; idx++) {
        let attr = elem.attributes[idx], strToLocalize = elem.attributes[idx].value;
        // Only handle attributes whose name is not data-localize (they were already handled above)
        // and whose value contains the __MSG_ string
        if (attr.name != "data-localize" && strToLocalize.includes("__MSG_")) {
          replace_i18n(attr, strToLocalize, true);
        }
      }
    });
  }

  static displayNotification(msg, title) {
    browser.notifications.create("foxyproxy-notification", {
      type: "basic",
      iconUrl: "icons/48x48.svg",
      title: title || "FoxyProxy",
      message: msg
    });
  }

  // We don't need cryptographically secure UUIDs, just something unique
  static getUniqueId() {
    return Math.random().toString(36).substring(7) + new Date().getTime();

    //return new Date().getTime(); // This isn't sufficient because it will use duplicate numbers when we create the 3 blacklist patterns for local IPs
    //return getRandomInt(1, Number.MAX_SAFE_INTEGER);

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#Getting_a_random_integer_between_two_values
    /*function getRandomInt(min, max) {
      min = Math.ceil(min);
      max = Math.floor(max);
      return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
    }*/
  }

  // https://stackoverflow.com/questions/8486099/how-do-i-parse-a-url-query-parameters-in-javascript
  static urlParamsToJsonMap() {
    let regex = /[?&]([^=#]+)=([^&#]*)/g, params = {}, match;
    while (match = regex.exec(location.href)) {
      params[match[1]] = JSON.parse(Utils._b64DecodeUnicode(match[2]));
    }
    return params;
  }

  static jsonObject2UriComponent(o) {
    return o ? Utils._b64EncodeUnicode(JSON.stringify(o)) : "";
  }

 /* static uriComponent2JsonObject(o) {
    return o ? JSON.parse(Utils._b64DecodeUnicode(o)) : "";
  }*/

  // To handle Unicode chars:
  // https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#Solution_1_–_escaping_the_string_before_encoding_it
  static _b64EncodeUnicode(str) {
      // first we use encodeURIComponent to get percent-encoded UTF-8,
      // then we convert the percent encodings into raw bytes which
      // can be fed into btoa.
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
          function toSolidBytes(match, p1) {
              return String.fromCharCode('0x' + p1);
      }));
  }

  // To handle Unicode chars:
  // https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#Solution_1_–_escaping_the_string_before_encoding_it
  static _b64DecodeUnicode(str) {
      // Going backwards: from bytestream, to percent-encoding, to original string.
      return decodeURIComponent(atob(str).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
  }

  static trimAllInputs(selector = ":input") {
    let allInputs = $(selector);
    allInputs.each(function() {
      $(this).val(($(this).val().trim()));
    });
  }

  static escapeAllInputs(selector = ":input") {
    let allInputs = $(selector);
    allInputs.each(function() {
      $(this).val($(this).val()
        .replace(/&/g, "") // If we replace with the escaped value, e.g. &amp; then the value will be double-escaped next time user opens the screen and this is called
        .replace(/</g, "")
        .replace(/>/g, "")
        .replace(/"/g, "")
        .replace(/'/g, "")
      );
    });
  }

  /**
   * Convert:
   *
   * const PROXY_TYPE_HTTP = 1;
   * const PROXY_TYPE_HTTPS = 2;
   * const PROXY_TYPE_SOCKS5 = 3;
   * const PROXY_TYPE_SOCKS4 = 4;
   * const PROXY_TYPE_NONE = 5;
   *
   * to a string and return
   */
/*  static proxyTypeAsString(proxyTypeInt) {
    switch (proxyTypeInt) {
      case PROXY_TYPE_HTTP: return "HTTP Proxy Server";
      case PROXY_TYPE_HTTPS: return "SSL Proxy Server";
      case PROXY_TYPE_SOCKS5: return "SOCKS 5 Proxy Server";
      case PROXY_TYPE_SOCKS4: return "SOCKS 4 Proxy Server";
      case PROXY_TYPE_NONE: return "No Proxy Server";
      default: return "Unknown Proxy Server";
    }
  }*/

  static wildcardStringToRegExpString(pat) {
    let start = 0, end = pat.length, matchOptionalSubdomains = false;
    if (pat[0] == ".") pat = '*' + pat;
    if (pat.indexOf("**") == 0) {
      // Strip asterisks from front and back
      while (pat[start] == "*" && start < end) start++;
      while (pat[end - 1] == "*" && start < end) end--;
      // If there's only an asterisk left, match everything
      if (end - start == 1 && pat[start] == "*") return new RegExp("");
    }
    else if (pat.indexOf("*.") == 0) {
      matchOptionalSubdomains = true;
    }

    let regExpStr = pat.substring(start, end+1)
      // $& replaces with the string found, but with that string escaped
      .replace(/[$.+()^{}\]\[|]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");

    if (matchOptionalSubdomains) {
        // Non-capturing group that matches:
        // any group of non-whitespace characters following by an optional . repeated zero or more times
        regExpStr = "(?:\\S+\\.)*" + regExpStr.substring(4);
    }

    // Leading or ending double-asterisks mean exact starting and ending positions
    if (start == 0) regExpStr = "^" + regExpStr;
    if (end == pat.length) regExpStr += "$";
    return regExpStr;
  }

  static safeRegExp(regExpStr) {
    try {
      return new RegExp(regExpStr);
    }
    catch(e) {
      console.error("safeRegExp(): Error creating regexp for pattern: " + JSON.stringify(regExpStr));
      console.error(e);
      Utils.displayNotification("Error creating regular expression for pattern: " + regExpStr);
      return new RegExp("a^"); // match nothing
    }
  }

  static findMatchingProxySetting(url, host, proxySettings) {
    let scheme = url.substring(0, url.indexOf("://")), schemeNum;
    if (scheme == "https") schemeNum = PROTOCOL_HTTPS;
    else if (scheme == "http") schemeNum = PROTOCOL_HTTP;
    //console.log("findMatchingProxySetting(): scheme is " + scheme);

    //console.log(`Utils.findMatchingProxySetting(): host is ${host} and url is ${url}`);
    // for loop is slightly faster than .forEach(), which calls a function and all the overhead with that
    // note: we've already thrown out inactive proxySettings and inactive patterns.
    // we're not iterating over them
    for (let i=0; i<proxySettings.length; i++) {
      let proxySetting = proxySettings[i];
      // Check black patterns first
      //console.log("Utils.findMatchingProxySetting(): checking black patterns");
      let patternObj = Utils.checkPatterns(proxySetting.blackPatterns, schemeNum, host);
      if (patternObj) {
        console.log("Utils.findMatchingProxySetting(): black match found: " + JSON.stringify(patternObj.pattern));
        continue; // A black pattern matched. Skip this proxySetting
      }

      //console.log("Utils.findMatchingProxySetting(): checking white patterns");
      patternObj = Utils.checkPatterns(proxySetting.whitePatterns, schemeNum, host);
      if (patternObj) {
        //console.log("Utils.findMatchingProxySetting(): white match found: " + JSON.stringify(patternObj.pattern));
        return {proxySetting: proxySetting, matchedPattern: patternObj};
      }
    }
    console.log("Utils.findMatchingProxySetting(): no match found. Returning null.");
    return null; // No white matches
  }

  static checkPatterns(patterns, schemeNum, host) {
    for (let j=0; j<patterns.length; j++) {
      let patternObj = patterns[j];
      //console.log("Utils.checkPatterns(): protocol of pattern is: " + patternObj.protocols);
      if (patternObj.protocols != PROTOCOL_ALL && patternObj.protocols != schemeNum) {
        //console.log("Utils.checkPatterns(): protocol mismatch; skipping.");
        continue;
      }
      //console.log("Utils.checkPatterns(): checking pattern " + patternObj.regExp.toString() + " against " + host);
      if (patternObj.regExp.test(host)) {
        //console.log("Utils.checkPatterns(): match found. Returning " + JSON.stringify(patternObj));
        return patternObj;
      }
    }
    return null;
  }

  static getNiceTitle(proxySetting) {
    let title = proxySetting.title ? proxySetting.title : (proxySetting.address + ":" + (proxySetting.port));
    return Utils.ellipsis(title);
  }

  static ellipsis(str, len=25) {
    if (!str) return "";
    return str.length > len ? (str.substring(0, len) + "...") : str;
  }

  static getOption(proxySetting) {
    if (Utils.isUnsupportedType(proxySetting.type)) return "";
    return $("#modeOptionTemplate").html().
      replace("%title", Utils.getNiceTitle(proxySetting)).
      replace(/%color/g, proxySetting.color).
      replace("%value", proxySetting.id).
      replace(/%idx/g, proxySetting.id).trim();
  }

  static isUnsupportedType(type) {
    return type == PROXY_TYPE_PAC || type == PROXY_TYPE_WPAD || type == PROXY_TYPE_SYSTEM || type == PROXY_TYPE_PASS;
  }

  // Force only one page to be shown at a time in order to avoid synch problems across multiple instances
  static showInternalPage(logOrProxies) {
    let internalUrls = [
        browser.runtime.getURL("log.html"),
        browser.runtime.getURL("proxies.html"),
        browser.runtime.getURL("add-edit-proxy.html"),
        browser.runtime.getURL("add-edit-patterns.html"),
        browser.runtime.getURL("patterns.html"),
        browser.runtime.getURL("import.html"),
        browser.runtime.getURL("about.html"),
        browser.runtime.getURL("first-install.html")
        //browser.runtime.getURL("pattern-help.html")
      ],
      url = logOrProxies == "log" ? internalUrls[0]: internalUrls[1];

    return browser.windows.getAll({
        populate: true,
        windowTypes: ["normal"]
      }).then((windowInfoArray) => {
        let found = false;
        for (let windowInfo of windowInfoArray) {
          for (let tab of windowInfo.tabs) {
            let u = new URL(tab.url) /* requires tab permission */, urlNoParams = u.origin + u.pathname;
            if (internalUrls.includes(urlNoParams)) { // Some of our pages have URL params. Ignore the params.
              found = true;
              browser.windows.update(windowInfo.id, {focused: true});
              return browser.tabs.update(tab.id, {active: true, url: url});
            }
          }
        }
        if (!found) return browser.tabs.create({url: url, active: true});
      });
  }

  static importFile(file, mimeTypeArr, maxSizeBytes, jsonOrXml, callback) {
    if (!file) {
      alert("There was an error");
      return;
    }

    // Check MIME type
    if (!mimeTypeArr.includes(file.type)) {
      alert("Unsupported file format");
      return;
    }

    if (file.size > maxSizeBytes) {
      alert("Filesize is too large");
      return;
    }

    let reader  = new FileReader();
    reader.onloadend = () => {
      if (reader.error) alert("Error reading file.");
      else {
        let settings;
        try {
          if (jsonOrXml == "json")
            settings = JSON.parse(reader.result);
          else if (jsonOrXml == "xml") {
            let parser = new DOMParser();
            settings = parser.parseFromString(reader.result, "text/xml");
            if (settings.documentElement.nodeName == "parsererror") throw new Error();
          }
        }
        catch(e) {
          console.log(e);
          alert("Error parsing file. Please remove sensitive data from the file, and then email it to support@getfoxyproxy.org so we can fix bugs in our parser.");
          return;
        }
        if (settings) {
          if (confirm("This will overwite existing proxy settings. Are you sure?")) callback(settings);
        }
      }
    };
    reader.onerror = () => { alert("Error reading file")};
    reader.readAsText(file);
  }

  static exportFile() {
    getAllSettings().then((settings) => {
      let blob = new Blob([JSON.stringify(settings, null, 2)], {type : 'text/plain'}),
        filename = "foxyproxy.json";
      browser.downloads.download({
        url: URL.createObjectURL(blob),
        filename,
        saveAs: true
      }).then(() => alert("Export finished")); // wait for it to complete before returning
    });
  }
}
