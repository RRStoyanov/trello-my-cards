(function($){


	// Card
	var Card = Backbone.Model.extend({

		toJSON: function() {
			var modelAttrs = Backbone.Model.prototype.toJSON.call(this);

			modelAttrs.lastActionUser = this.lastActionUser();
			modelAttrs.lastActionDate = $.timeago(this.lastActionDate());

			return modelAttrs;
		},

		lastAction: function() {
			if (this.get('actions') && this.get('actions')[0]) {
				return this.get('actions')[0];
			}
			return false;
		},

		lastActionUser: function() {
			var lastAction = this.lastAction();
			if (!lastAction) {
				return;
			}
			return lastAction.memberCreator.fullName;
		},

		lastActionDate: function() {
			var lastAction = this.lastAction();
			if (!lastAction) {
				return;
			}

			return $.timeago.parse(lastAction.date);
		}

	});

	var CardList = Backbone.Collection.extend({
		model: Card,

		// sort by last activity date
		comparator: function(card) {
			return -card.lastActionDate();
		}

	});

	var CardView = Backbone.View.extend({
		tagName: 'li',
		className: 'card',

		template: _.template('<a href="<%= url %>" target="_blank"><%= name %>' +
				'<br /><div class="subscript">Last action: <%= lastActionUser %> <%= lastActionDate %> | <span class="list">loading</span></div>' +
				'</a>'),

		initialize: function() {
			this.model.bind('change', this.render, this);
		},

		render: function() {
			this.$el.html(this.template(this.model.toJSON()));
			this.$el.attr("data-list-id", this.model.get("idList"));
			return this;
		}
	});


	// Board
	var Board = Backbone.Model.extend({

		initialize: function() {
			this.cards = new CardList();
		},

		addCard: function(card) {
			this.cards.add(card);
		}
	});

	var BoardList = Backbone.Collection.extend({
		model: Board
	});

	var BoardView = Backbone.View.extend({
		tagName: 'div',
		className: 'board',

		template: _.template('<strong><%= name %></strong><ul class="cards"></ul>'),

		initialize: function() {
			this.model.cards.bind('add', this.render, this);
		},

		render: function() {
			var boardView = this;
			this.$el.html(this.template(this.model.toJSON()));

			this.$(".cards").empty();
			this.model.cards.each(function(card) {
				var view = new CardView({model: card});
				boardView.$(".cards").append(view.render().el);
			});

			return this;
		}
	});


	// App
	var App = Backbone.View.extend({

		initialize: function() {
			this.boards = new BoardList();
			this.boards.bind('add', this.render, this);

			this.bind('usersCardsLoaded', this.render, this);
			this.bind('usersCardsLoaded', this.loadMentions, this);
			this.bind('usersCardsLoaded', this.loadCommentedCards, this);

			this.userData = null;
			this.lists = [];

			this.loadData();
		},

		render: function() {
			var appView = this;
			appView.$el.empty();

			this.boards.each(function(board) {
				var view = new BoardView({model: board});
				appView.$el.append(view.render().el);
			});
		},

		loadData: function() {
			var app = this;

			var boardsLoaded = Trello.get("members/me?actions=commentCard&boards=open&notifications=mentionedOnCard", function(myData) {

				app.userData = myData;

				// boards
				_.each(myData.boards, function(board) {
					app.boards.add(board);
				});

			});

			// users cards
			var myCardsLoaded = $.when(boardsLoaded)
				.then(function() {

				console.time("members load");
				 Trello.get("members/me/cards/open?actions=commentCard,createCard,updateCard,createList,updateList,addMemberToCard,removeMemberFromCard", function(cards) {
					 console.time("cards");
					 console.timeEnd("members load");

					 var listIds = [];

					 _.each(cards, function(card) {
						 var board = app.boards.get(card.idBoard);
						 if (!board) {
							 console.log('board ' + card.idBoard + ' not found', card);
							 return;
						 }
						 board.cards.add(card, {silent: true});
						 listIds.push(card.idList);
					 });

					 app.trigger('usersCardsLoaded');

					 // lazy update of list names
					  _.chain(listIds)
						 .unique()
						 .each(_.bind(app.loadList, app));

					 console.timeEnd("cards");
				 });
			 });

		},

		loadMentions: function() {
			var app = this;
			_.each(this.userData.notifications, function(notification) {
				var board = app.boards.get(notification.data.board.id);
				if (!board) {
					console.log('board ' + notification.data.board.id + ' not found');
					return;
				}

				var card = board.cards.get(notification.data.card.id);
				if (card) {
					return;
				}

				Trello.get('cards/' + notification.data.card.id + '?actions=commentCard,createCard,updateCard,createList,updateList,addMemberToCard,removeMemberFromCard', function(card) {
					board.addCard(card);
				});
			});
		},

		loadCommentedCards: function() {
			var app = this;
			console.log(this.userData);
			_.each(this.userData.actions, function(action) {
				var board = app.boards.get(action.data.board.id);
				if (!board) {
					console.log('board ' + action.data.board.id + ' not found');
					return;
				}

				var card = board.cards.get(action.data.card.id);
				if (card) {
					return;
				}

				Trello.get('cards/' + action.data.card.id + '?actions=commentCard,createCard,updateCard,createList,updateList,addMemberToCard,removeMemberFromCard', function(card) {
					board.addCard(card);

					app.loadList(card.idList);
				});
			});
		},

		loadList: function(idList) {
			var app = this, list = _.find(this.lists, function(list) {
				return list.id == idList;
			});

			if (list) {
				this.updateListNames(list);
				return;
			}

			Trello.get('lists/' + idList, function(list) {
				app.lists.push(list);
				app.updateListNames(list);
			});
		},

		updateListNames: function(list) {
			this.$("li[data-list-id=" + list.id + "] .list").text(list.name);
		}

	});

	window.TrelloApp = App;


}(jQuery));