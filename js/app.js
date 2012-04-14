(function($){


	var Filter = Backbone.Model.extend({
		localStorage: new Backbone.LocalStorage("filters"),

		defaults: {
			flags: ["assignedToUser"],
			showDone: true
		}
	});

	var FilterView = Backbone.View.extend({


		template: _.template('<div class="checkboxes">' +
				'<input type="checkbox" name="assignedToUser" id="assignedToUser" /><label for="assignedToUser"><span class="square assignedToUser"></span><span class="label">Assigned to me</span></label>' +
				'<input type="checkbox" name="commentedByUser" id="commentedByUser" /><label for="commentedByUser"><span class="square commentedByUser"></span><span class="label">My comments</span></label>' +
				'<input type="checkbox" name="userMention" id="userMention" /><label for="userMention"><span class="square userMention"></span><span class="label">Mentions</span></label>' +
			'</div>' +
               '<div class="showDone"><input type="checkbox" id="showDone" name="showDone"/><label for="showDone">Show cards in done lists</label></div>'
			),

		events: {
			"change :checkbox": "filterChanged"
		},

		initialize: function() {

		},

		render: function() {
			var filterView = this;
			this.$el.html(this.template());
			_.each(['assignedToUser', 'commentedByUser', 'userMention'], function(flag) {
				filterView.$('[name=' + flag + ']').prop('checked', _.contains(filterView.model.get('flags'), flag));
			});	
			this.$('.checkboxes').buttonset();


			this.$showDoneCheckbox = this.$('[name=showDone]');

			if (this.model.get('showDone')) {
				this.$showDoneCheckbox.prop('checked', true);
			}

		},

		filterChanged: function() {
			var displayFlags = [];
			this.$('.checkboxes input:checked').each(function() {
				displayFlags.push($(this).attr('name'));
			});

			this.model.set("flags", displayFlags);
			this.model.set("showDone", this.$showDoneCheckbox.is(':checked'));
			this.model.save();
		}
	});

	// Card
	var Card = Backbone.Model.extend({

		defaults: {
			flags: [],
			listName: 'loading'
		},

		initialize: function() {
			$.subscribe('listLoaded', _.bind(this.updateListName, this));
		},

		updateListName: function(list) {
			if (list.id != this.get('idList')) {
				return;
			}
			this.set('listName', list.name);
		},

		toJSON: function() {
			var modelAttrs = Backbone.Model.prototype.toJSON.call(this);

			modelAttrs.lastActionUser = this.lastActionUser();
			modelAttrs.lastActionDate = $.timeago(this.lastActionDate());

			return modelAttrs;
		},

		addFlag: function(flag) {
			var flags = this.get('flags');
			flags.push(flag);
			this.set('flags', _.unique(flags));
		},

		hasFlag: function(flag) {
			return _.contains(this.get('flags'), flag);
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
		},

		matchesFilter: function(filter) {
			var card = this, result = true;
			result &= _.any(filter.get('flags'), function(flag) {
				return card.hasFlag(flag);
			});

			if (!filter.get('showDone')) {
				result &= card.get('listName') != 'Done';
			}

			return result;
		}

	});

	var CardList = Backbone.Collection.extend({
		model: Card,

		// sort by last activity date
		comparator: function(card) {
			return -card.lastActionDate();
		},

		filtered: function(filter) {
			return _(this.filter(function(card) {
				return card.matchesFilter(filter);
			}));
		}

	});

	var CardView = Backbone.View.extend({
		tagName: 'li',
		className: 'card',

		template: _.template('<a href="<%= url %>" target="_blank">' +
				'<div class="flags clearfix"><% _.each(flags, function(flagName) { %> <span class="flag <%= flagName %>"></span> <% }); %></div>' +
				'<%= name %>' +
				'<br /><div class="subscript">Last action: <%= lastActionUser %> <%= lastActionDate %> | <span class="list"><%= listName %></span></div>' +
				'</a>'),

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

		template: _.template('<a href="<%= url %>" class="header"><%= name %></a><ul class="cards"></ul><div class="loading_dots">' +
				'<span></span>' +
				'<span></span>' +
				'<span></span>' +
				'</div>'),

		initialize: function() {
			this.cardViews = {};
			this.model.cards.bind('all', this.render, this);

			this.options.filter.bind('change', this.render, this);
		},

		getCardView: function(card) {
			if (!this.cardViews[card.id]) {
				this.cardViews[card.id] = new CardView({
					model: card
				});
			}
			return this.cardViews[card.id];
		},

		render: function() {
			var boardView = this;
			this.$el.html(this.template(this.model.toJSON()));

			this.$('.cards').empty();
			this.model.cards.filtered(this.options.filter).each(function(card) {
				boardView.$('.cards').append(boardView.getCardView(card).render().el);
			});
			

			return this;
		}
	});


	// App
	var App = Backbone.View.extend({

		options: {
			cardActions: 'commentCard,createCard,updateCard,createList,updateList,addMemberToCard,removeMemberFromCard'
		},

		initialize: function() {
			var app = this;

			this.boards = new BoardList();
			this.boards.bind('add', this.boardAdded, this);

			this.bind('usersCardsLoaded', function() {
				app.$el.addClass("loaded");
			});

			this.userData = null;
			this.lists = [];

			this.initFilter();
			this.loadData();
		},


		initFilter: function() {
			this.filter = new Filter({id: 'main'});
			this.filter.fetch();
		},

		render: function() {
			var filterView = new FilterView({
				el: this.$('.filter'),
				model: this.filter
			});
			filterView.render();
			return this;
		},

		boardAdded: function(board) {
			var view = new BoardView({
				model: board,
				filter: this.filter
			});
			this.$('.boards .loading').hide();
			this.$('.boards').append(view.render().el);
		},

		loadData: function() {
			var app = this;

			Trello.get("members/me?actions=commentCard&boards=open&notifications=mentionedOnCard&board_fields=name,closed,url", function(myData) {

				app.userData = myData;

				// boards
				_.each(myData.boards, function(board) {
					app.boards.add(board);
				});

				app.loadUsersCards();
			});
		},

		loadUsersCards: function() {
			var app = this

			console.time("members load");
			Trello.get("members/me/cards/open?actions=" + app.options.cardActions, function(cards) {
				 console.time("cards");
				 console.timeEnd("members load");

				 var listIds = [], boardsCards = {};

				 // group by boards and separate list ids
				 _.each(cards, function(card) {
					 if (!boardsCards[card.idBoard]) {
					 	boardsCards[card.idBoard] = [];
					 }

					 card.flags = ['assignedToUser'];
					 boardsCards[card.idBoard].push(card);
					 listIds.push(card.idList);
				 });

				 _.each(boardsCards, function(cards, idBoard) {
				 	var board = app.boards.get(idBoard);
					 if (!board) {
						 console.log('board' + idBoard + ' not found');
						 return;
					 }

					 board.cards.reset(cards);
				 });

				 app.loadMentions();
				 app.loadCommentedCards();

				app.trigger('usersCardsLoaded');

				  _.chain(listIds)
					 .unique()
					 .each(_.bind(app.loadList, app));

				 console.timeEnd("cards");
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
					card.addFlag('userMention');
					return;
				}

				Trello.get('cards/' + notification.data.card.id + '?actions=' + app.options.cardActions, function(card) {
					card.flags = ['userMention'];
					board.addCard(card);
					app.loadList(card.idList);
				});
			});
		},

		loadCommentedCards: function() {
			var app = this;
			_.each(this.userData.actions, function(action) {
				var board = app.boards.get(action.data.board.id);
				if (!board) {
					console.log('board ' + action.data.board.id + ' not found');
					return;
				}

				var card = board.cards.get(action.data.card.id);
				if (card) {
					card.addFlag('commentedByUser');
					return;
				}

				Trello.get('cards/' + action.data.card.id + '?actions=' + app.options.cardActions, function(card) {
					card.flags = ['commentedByUser'];
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
				$.publish('listLoaded', list);
				return;
			}

			Trello.get('lists/' + idList, function(list) {
				app.lists.push(list);
				$.publish("listLoaded", list);
			});
		}

	});

	window.TrelloApp = App;


}(jQuery));