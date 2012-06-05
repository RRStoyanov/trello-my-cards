// Generated by CoffeeScript 1.3.1
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  jQuery(function($) {
    var App, Board, BoardList, BoardView, Card, CardList, CardView, Filter, FilterView;
    Filter = (function(_super) {

      __extends(Filter, _super);

      Filter.name = 'Filter';

      function Filter() {
        return Filter.__super__.constructor.apply(this, arguments);
      }

      Filter.prototype.localStorage = new Backbone.LocalStorage("filters");

      Filter.prototype.defaults = {
        flags: ['assignedToUser'],
        showDone: true,
        search: ''
      };

      Filter.prototype.toString = function() {
        var params;
        params = this.get('flags').slice().sort();
        if (this.get('showDone')) {
          params.push('showDone');
        }
        return params.join('|');
      };

      return Filter;

    })(Backbone.Model);
    FilterView = (function(_super) {

      __extends(FilterView, _super);

      FilterView.name = 'FilterView';

      function FilterView() {
        this.gaTrackChangeEvent = __bind(this.gaTrackChangeEvent, this);
        return FilterView.__super__.constructor.apply(this, arguments);
      }

      FilterView.prototype.template = _.template('<div class="checkboxes">' + '<input type="checkbox" name="assignedToUser" id="assignedToUser" /><label for="assignedToUser"><span class="square assignedToUser"></span><span class="label">Assigned to me</span></label>' + '<input type="checkbox" name="commentedByUser" id="commentedByUser" /><label for="commentedByUser"><span class="square commentedByUser"></span><span class="label">My comments</span></label>' + '<input type="checkbox" name="userMention" id="userMention" /><label for="userMention"><span class="square userMention"></span><span class="label">Mentions</span></label>' + '</div>' + '<div class="showDone"><input type="checkbox" id="showDone" name="showDone"/><label for="showDone">Show cards in done lists</label></div>' + '<input class="search" name="search" placeholder="Search..."/>');

      FilterView.prototype.events = {
        "change :checkbox": "filterChanged",
        "keyup input[name=search]": "filterChanged"
      };

      FilterView.prototype.initialize = function() {
        return this.model.bind('change', this.gaTrackChangeEvent);
      };

      FilterView.prototype.render = function() {
        var filterView;
        filterView = this;
        this.$el.html(this.template());
        _.each(['assignedToUser', 'commentedByUser', 'userMention'], function(flag) {
          return filterView.$('[name=' + flag + ']').prop('checked', _.contains(filterView.model.get('flags'), flag));
        });
        this.$('.checkboxes').buttonset();
        this.$showDoneCheckbox = this.$('[name=showDone]');
        if (this.model.get('showDone')) {
          this.$showDoneCheckbox.prop('checked', true);
        }
        return this.$('[name=search]').val(this.model.get('search'));
      };

      FilterView.prototype.filterChanged = function() {
        var displayFlags;
        displayFlags = [];
        this.$('.checkboxes input:checked').each(function() {
          return displayFlags.push($(this).attr('name'));
        });
        this.model.set("flags", displayFlags);
        this.model.set("search", this.$('[name=search]').val());
        this.model.set("showDone", this.$showDoneCheckbox.is(':checked'));
        return this.model.save();
      };

      FilterView.prototype.gaTrackChangeEvent = function() {
        return _gaq.push(['_trackEvent', 'Filters', 'Change', this.model.toString()]);
      };

      return FilterView;

    })(Backbone.View);
    Card = (function(_super) {

      __extends(Card, _super);

      Card.name = 'Card';

      function Card() {
        this.updateListName = __bind(this.updateListName, this);
        return Card.__super__.constructor.apply(this, arguments);
      }

      Card.prototype.defaults = {
        flags: [],
        listName: 'loading'
      };

      Card.prototype.initialize = function() {
        return $.subscribe('listLoaded', this.updateListName);
      };

      Card.prototype.updateListName = function(list) {
        if (list.id !== this.get('idList')) {
          return;
        }
        return this.set('listName', list.name);
      };

      Card.prototype.toJSON = function() {
        var modelAttrs;
        modelAttrs = Backbone.Model.prototype.toJSON.call(this);
        modelAttrs.lastActionUser = this.lastActionUser();
        modelAttrs.lastActionDate = $.timeago(this.lastActionDate());
        modelAttrs.dueDate = this.dueDate();
        return modelAttrs;
      };

      Card.prototype.addFlag = function(flag) {
        var flags;
        flags = this.get('flags');
        flags.push(flag);
        return this.set('flags', _.unique(flags));
      };

      Card.prototype.hasFlag = function(flag) {
        return _.contains(this.get('flags'), flag);
      };

      Card.prototype.lastAction = function() {
        if (this.get('actions') && this.get('actions')[0]) {
          return this.get('actions')[0];
        }
        return false;
      };

      Card.prototype.lastActionUser = function() {
        var lastAction;
        lastAction = this.lastAction();
        if (!lastAction) {
          return;
        }
        return lastAction.memberCreator.fullName;
      };

      Card.prototype.lastActionDate = function() {
        var lastAction;
        lastAction = this.lastAction();
        if (!lastAction) {
          return;
        }
        return $.timeago.parse(lastAction.date);
      };

      Card.prototype.dueDate = function() {
        if (!this.get('badges').due) {
          return;
        }
        return $.timeago.parse(this.get('badges').due);
      };

      /*
      		Possible flags:
      		due
      		due-past
      		due-now
      		due-soon
      		due-future
      */


      Card.prototype.dueDateFlag = function() {
        var dueDate, now;
        dueDate = this.dueDate();
        now = new Date();
        if (!dueDate) {
          return '';
        }
        if (dueDate < now) {
          return 'due-past';
        }
        if (dueDate < now.getTime() + 4 * 1000 * 60 * 60) {
          return 'due-now';
        }
        if (dueDate < now.getTime() + 24 * 1000 * 60 * 60) {
          return 'due-soon';
        }
        return 'due-future';
      };

      Card.prototype.matchesFilter = function(filter) {
        var card, regexp, result;
        card = this;
        result = true;
        result &= _.any(filter.get('flags'), function(flag) {
          return card.hasFlag(flag);
        });
        if (!filter.get('showDone')) {
          result &= card.get('listName') !== 'Done';
        }
        if (filter.get('search')) {
          regexp = new RegExp(filter.get('search'), 'i');
          result &= card.get('name').search(regexp) >= 0;
        }
        return result;
      };

      return Card;

    })(Backbone.Model);
    CardList = (function(_super) {

      __extends(CardList, _super);

      CardList.name = 'CardList';

      function CardList() {
        return CardList.__super__.constructor.apply(this, arguments);
      }

      CardList.prototype.model = Card;

      CardList.prototype.comparator = function(firstCard, secondCard) {
        if (firstCard.dueDate() === secondCard.dueDate()) {
          return -1 * (firstCard.lastActionDate() - secondCard.lastActionDate());
        }
        if (firstCard.dueDate() === void 0) {
          return 1;
        }
        if (secondCard.dueDate() === void 0) {
          return -1;
        }
        return firstCard.dueDate() - secondCard.dueDate();
      };

      CardList.prototype.filtered = function(filter) {
        return _(this.filter(function(card) {
          return card.matchesFilter(filter);
        }));
      };

      return CardList;

    })(Backbone.Collection);
    CardView = (function(_super) {

      __extends(CardView, _super);

      CardView.name = 'CardView';

      function CardView() {
        return CardView.__super__.constructor.apply(this, arguments);
      }

      CardView.prototype.tagName = 'li';

      CardView.prototype.className = 'card';

      CardView.prototype.template = _.template('<a href="<%= url %>" class="clearfix" target="_blank">' + '<div class="flags clearfix"><% _.each(flags, function(flagName) { %> <span class="flag <%= flagName %>"></span> <% }); %></div>' + '<div class="name"><%= name %></div>' + '<div class="badges">' + '<% if(dueDate) { %><div class="badge due"><span class="app-icon small-icon date-icon"></span><%= dateFormat(dueDate,"mmm d") %></div><% } %>' + '</div><div class="subscript">' + 'Last action: <%= lastActionUser %> <%= lastActionDate %> | <span class="list"><%= listName %></span></div>' + '</a>');

      CardView.prototype.dueDateFlagsShades = {
        'due-past': 'light',
        'due-now': 'light',
        'due-soon': 'light',
        'due-future': ''
      };

      CardView.prototype.render = function() {
        this.$el.html(this.template(this.model.toJSON()));
        this.$('.badge.due').addClass(this.model.dueDateFlag());
        this.$('.badge.due .app-icon').addClass(this.dueDateFlagsShades[this.model.dueDateFlag()] ? this.dueDateFlagsShades[this.model.dueDateFlag()] : '');
        return this;
      };

      return CardView;

    })(Backbone.View);
    Board = (function(_super) {

      __extends(Board, _super);

      Board.name = 'Board';

      function Board() {
        return Board.__super__.constructor.apply(this, arguments);
      }

      Board.prototype.initialize = function() {
        return this.cards = new CardList();
      };

      Board.prototype.addCard = function(card) {
        return this.cards.add(card);
      };

      return Board;

    })(Backbone.Model);
    BoardList = (function(_super) {

      __extends(BoardList, _super);

      BoardList.name = 'BoardList';

      function BoardList() {
        return BoardList.__super__.constructor.apply(this, arguments);
      }

      BoardList.prototype.model = Board;

      return BoardList;

    })(Backbone.Collection);
    BoardView = (function(_super) {

      __extends(BoardView, _super);

      BoardView.name = 'BoardView';

      function BoardView() {
        this.render = __bind(this.render, this);
        return BoardView.__super__.constructor.apply(this, arguments);
      }

      BoardView.prototype.tagName = 'div';

      BoardView.prototype.className = 'board';

      BoardView.prototype.template = _.template('<a href="<%= url %>" class="header"><%= name %></a><ul class="cards"></ul><div class="loading_dots">' + '<span></span>' + '<span></span>' + '<span></span>' + '</div>');

      BoardView.prototype.initialize = function() {
        this.cardViews = {};
        this.model.cards.bind('all', this.render);
        return this.options.filter.bind('change', this.render);
      };

      BoardView.prototype.getCardView = function(card) {
        if (!this.cardViews[card.id]) {
          this.cardViews[card.id] = new CardView({
            model: card
          });
        }
        return this.cardViews[card.id];
      };

      BoardView.prototype.render = function() {
        var boardView, cards;
        boardView = this;
        this.$el.html(this.template(this.model.toJSON()));
        this.$('.cards').empty();
        cards = this.model.cards.filtered(this.options.filter);
        cards.each(function(card) {
          return boardView.$('.cards').append(boardView.getCardView(card).render().el);
        });
        if (cards.size() === 0) {
          this.$el.addClass('noCards');
        } else {
          this.$el.removeClass('noCards');
        }
        return this;
      };

      return BoardView;

    })(Backbone.View);
    App = (function(_super) {

      __extends(App, _super);

      App.name = 'App';

      function App() {
        this.boardAdded = __bind(this.boardAdded, this);
        return App.__super__.constructor.apply(this, arguments);
      }

      App.prototype.options = {
        cardActions: 'commentCard,createCard,updateCard,createList,addMemberToCard,removeMemberFromCard'
      };

      App.prototype.initialize = function() {
        var app;
        app = this;
        this.boards = new BoardList();
        this.boards.bind('add', this.boardAdded);
        this.bind('usersCardsLoaded', function() {
          return app.$el.addClass("loaded");
        });
        this.userData = null;
        this.lists = [];
        this.initFilter();
        return this.loadData();
      };

      App.prototype.initFilter = function() {
        this.filter = new Filter({
          id: 'main'
        });
        return this.filter.fetch();
      };

      App.prototype.render = function() {
        var filterView;
        filterView = new FilterView({
          el: this.$('.filter'),
          model: this.filter
        });
        filterView.render();
        return this;
      };

      App.prototype.boardAdded = function(board) {
        var view;
        view = new BoardView({
          model: board,
          filter: this.filter
        });
        this.$('.boards .loading').hide();
        return this.$('.boards').append(view.render().el);
      };

      App.prototype.loadData = function() {
        var app;
        app = this;
        return Trello.get("members/me?actions=commentCard&boards=open&notifications=mentionedOnCard&board_fields=name,closed,url", function(myData) {
          app.userData = myData;
          _.each(myData.boards, function(board) {
            return app.boards.add(board);
          });
          return app.loadUsersCards();
        });
      };

      App.prototype.loadUsersCards = function() {
        var app;
        app = this;
        console.time("members load");
        return Trello.get("members/me/cards/open?actions=" + app.options.cardActions, function(cards) {
          var boardsCards, listIds;
          console.time("cards");
          console.timeEnd("members load");
          listIds = [];
          boardsCards = {};
          _.each(cards, function(card) {
            if (!boardsCards[card.idBoard]) {
              boardsCards[card.idBoard] = [];
            }
            card.flags = ['assignedToUser'];
            boardsCards[card.idBoard].push(card);
            return listIds.push(card.idList);
          });
          _.each(boardsCards, function(cards, idBoard) {
            var board;
            board = app.boards.get(idBoard);
            if (!board) {
              console.log('board' + idBoard + ' not found');
              return;
            }
            return board.cards.reset(cards);
          });
          app.loadMentions();
          app.loadCommentedCards();
          app.trigger('usersCardsLoaded');
          _.chain(listIds).unique().each(_.bind(app.loadList, app));
          return console.timeEnd("cards");
        });
      };

      App.prototype.loadMentions = function() {
        var app;
        app = this;
        return _.each(this.userData.notifications, function(notification) {
          var board, card;
          board = app.boards.get(notification.data.board.id);
          if (!board) {
            console.log('board ' + notification.data.board.id + ' not found');
            return;
          }
          card = board.cards.get(notification.data.card.id);
          if (card) {
            card.addFlag('userMention');
            return;
          }
          return Trello.get('cards/' + notification.data.card.id + '?actions=' + app.options.cardActions, function(card) {
            card.flags = ['userMention'];
            board.addCard(card);
            return app.loadList(card.idList);
          });
        });
      };

      App.prototype.loadCommentedCards = function() {
        var app;
        app = this;
        return _.each(this.userData.actions, function(action) {
          var board, card;
          board = app.boards.get(action.data.board.id);
          if (!board) {
            console.log('board ' + action.data.board.id + ' not found');
            return;
          }
          card = board.cards.get(action.data.card.id);
          if (card) {
            card.addFlag('commentedByUser');
            return;
          }
          return Trello.get('cards/' + action.data.card.id + '?actions=' + app.options.cardActions, function(card) {
            card.flags = ['commentedByUser'];
            board.addCard(card);
            return app.loadList(card.idList);
          });
        });
      };

      App.prototype.loadList = function(idList) {
        var app, list;
        app = this;
        list = _.find(this.lists, function(list) {
          return list.id === idList;
        });
        if (list) {
          $.publish('listLoaded', list);
          return;
        }
        return Trello.get('lists/' + idList, function(list) {
          app.lists.push(list);
          return $.publish("listLoaded", list);
        });
      };

      return App;

    })(Backbone.View);
    return window.TrelloApp = App;
  });

}).call(this);
