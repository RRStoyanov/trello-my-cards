jQuery(function($) {

	var closeCurrentTab = function() {
        chrome.tabs.getCurrent(function (tab) {
            chrome.tabs.remove( tab.id );
        });
	}, onAuthorize = function() {
		$("body").addClass("authorized");
		setTimeout(closeCurrentTab, 10000);
	};
						  
	Trello.authorize({
		interactive: false,
		success: onAuthorize
	});

	if (!Trello.authorized()) {
		Trello.authorize({
			expiration: "never",
			name: "My Cards For Trello",
			success: onAuthorize
		});
	}
});