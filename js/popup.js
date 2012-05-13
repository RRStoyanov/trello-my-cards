jQuery(function($) {

	if (window.navigator.userAgent.indexOf('Macintosh') == -1) {
		$('body').addClass("custom-scroll");
	}

	$("#connectLink").attr("href", chrome.extension.getURL('connect.html'));

	Trello.authorize({
		interactive: false,
		success: function() {
			
			$("#auth").hide();
			$("#app").show();

			new TrelloApp({
				el: $("#app")
			}).render();
		}
	});
});