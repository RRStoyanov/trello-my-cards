jQuery(function($) {

	var closeCurrentTab = function() {
        chrome.tabs.getCurrent(function (tab) {
            chrome.tabs.remove( tab.id );
        });
	}, onAuthorize = function() {
		$("#output").empty();
		
		Trello.members.get("me", function(member){
			$("#output").append("Thank you, you're now authenticated you can start using Trello My Cards extension immediately. <br/>This page will be automatically closed in few seconds.");
		});

		setTimeout(closeCurrentTab, 1O * 1000);
	};
						  
	Trello.authorize({
		interactive: false,
		success: onAuthorize
	});

	if (!Trello.authorized()) {
		Trello.authorize({
			expiration: "never",
			name: "Trello My Cards",
			success: onAuthorize
		});
	}
});