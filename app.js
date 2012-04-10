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

		template: _.template('<a href="<%= url %>"><%= name %>' +
				'<br /><div class="subscript"><%= lastActionUser %> <%= lastActionDate %></div>' +
				'</a>'),

		initialize: function() {
			this.model.bind('change', this.render, this);
		},

		render: function() {
			this.$el.html(this.template(this.model.toJSON()));
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
			this.bind('dataLoaded', this.render, this);

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
				// boards
				_.each(myData.boards, function(board) {
					app.boards.add(board);
				});
			});

			// users cards
			$.when(boardsLoaded)
				.then(function() {
				console.time("members load");
				 Trello.get("members/me/cards/open?actions=commentCard,createCard,updateCard,createList,updateList,addMemberToCard,removeMemberFromCard", function(cards) {
					 console.time("cards");
					 console.timeEnd("members load");

					 _.each(cards, function(card) {
						 var board = app.boards.get(card.idBoard);
						 if (!board) {
							 console.log('board ' + card.idBoard + ' not found', card);
							 return;
						 }
						 board.cards.add(card, {silent: true});
					 });

					 app.trigger('dataLoaded');
					console.timeEnd("cards");
				 });
			 });
		}
	});

	window.TrelloApp = App;


}(jQuery));