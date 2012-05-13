var _gaq = _gaq || [];
  _gaq.push(['_setAccount', 'UA-31479829-1']);
  _gaq.push(['_trackPageview']);

  (function() {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = 'https://ssl.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);


    window.onerror = function(message, file, line) { 
   		var sFormattedMessage = '[' + file + ' (' + line + ')] ' + message; 
   		_gaq.push(['_trackEvent', 'Exceptions', 'Application', sFormattedMessage, null, true]);
	}

  })();
