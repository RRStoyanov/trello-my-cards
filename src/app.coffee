

jQuery ($) ->

	class Filter extends Backbone.Model
		localStorage: new Backbone.LocalStorage "filters"

		defaults:
			flags: ['assignedToUser']
			showDone: true
			search: ''

		toString: ->
			params = this.get('flags').slice().sort()

			if (@get 'showDone')
				params.push 'showDone'

			params.join '|'


	class FilterView extends Backbone.View

		template: _.template '<div class="checkboxes">' +
					'<input type="checkbox" name="assignedToUser" id="assignedToUser" /><label for="assignedToUser"><span class="square assignedToUser"></span><span class="label">Assigned to me</span></label>' +
					'<input type="checkbox" name="commentedByUser" id="commentedByUser" /><label for="commentedByUser"><span class="square commentedByUser"></span><span class="label">My comments</span></label>' +
					'<input type="checkbox" name="userMention" id="userMention" /><label for="userMention"><span class="square userMention"></span><span class="label">Mentions</span></label>' +
				'</div>' +
	            '<div class="showDone"><input type="checkbox" id="showDone" name="showDone"/><label for="showDone">Show cards in done lists</label></div>' +
	            '<input class="search" name="search" placeholder="Search..."/>'

		events:
			"change :checkbox": "filterChanged",
			"keyup input[name=search]": "filterChanged"

		initialize: ->
			@model.bind 'change', @gaTrackChangeEvent

		render: ->
			filterView = @
			@$el.html @template();

			_.each ['assignedToUser', 'commentedByUser', 'userMention'], (flag) ->
				filterView.$('[name=' + flag + ']').prop('checked', _.contains(filterView.model.get('flags'), flag))
			
			@$('.checkboxes').buttonset()

			@$showDoneCheckbox = @$ '[name=showDone]'
			if @model.get 'showDone'
				@$showDoneCheckbox.prop 'checked', true

			@$('[name=search]').val(@model.get 'search')

			
		filterChanged: ->
			displayFlags = []
			@$('.checkboxes input:checked').each ->
				displayFlags.push $(this).attr('name')

			@model.set "flags", displayFlags
			@model.set "search", @$('[name=search]').val()
			@model.set "showDone", this.$showDoneCheckbox.is(':checked')
			@model.save()

		gaTrackChangeEvent: =>
			_gaq.push ['_trackEvent', 'Filters', 'Change', @model.toString()];

	class Card extends Backbone.Model

		defaults:
			flags: []
			listName: 'loading'

		initialize: ->
			$.subscribe 'listLoaded', @updateListName

		updateListName: (list) =>
			if list.id != @get 'idList'
				return
			
			@set 'listName', list.name

		toJSON: ->
			modelAttrs = Backbone.Model.prototype.toJSON.call @

			modelAttrs.lastActionUser = @lastActionUser()
			modelAttrs.lastActionDate = $.timeago @lastActionDate()
			modelAttrs.dueDate = @dueDate()

			modelAttrs

		addFlag: (flag) ->
			flags = @get 'flags'
			flags.push flag
			@set 'flags', _.unique(flags)

		hasFlag: (flag) ->
			_.contains(@get('flags'), flag)

		lastAction: ->
			if @get('actions') && @get('actions')[0]
				return @get('actions')[0]
			false

		lastActionUser: ->
			lastAction = @lastAction()
			if !lastAction
				return
			lastAction.memberCreator.fullName

		lastActionDate: ->
			lastAction = this.lastAction()
			if !lastAction
				return
			$.timeago.parse lastAction.date

		dueDate: ->
			if !@get('badges').due
				return
			$.timeago.parse @get('badges').due

		###
		Possible flags:
		due
		due-past
		due-now
		due-soon
		due-future
		###
		dueDateFlag: ->
			dueDate = @dueDate()
			now = new Date()

			if !dueDate
				return ''

			if dueDate < now
				return 'due-past'

			if dueDate < now.getTime() + 4 * 1000 * 60 *60
				return 'due-now'

			if dueDate < now.getTime() + 24 * 1000 * 60 *60
				return 'due-soon'

			return 'due-future'


		matchesFilter: (filter) ->
			card = @
			result = true
			result &= _.any filter.get('flags'), (flag) ->
				card.hasFlag flag

			if !filter.get 'showDone'
				result &= card.get('listName') != 'Done'

			if filter.get 'search'
				regexp = new RegExp filter.get('search'), 'i'
				result &= (card.get('name').search(regexp) >= 0)

			result

	class CardList extends Backbone.Collection
		model: Card

		comparator: (firstCard, secondCard) ->
			if firstCard.dueDate() == secondCard.dueDate()
				return -1 * (firstCard.lastActionDate() - secondCard.lastActionDate())

			if firstCard.dueDate() == undefined
				return 1

			if secondCard.dueDate() == undefined
				return -1

			return firstCard.dueDate() - secondCard.dueDate()

		filtered: (filter) ->
			_ @filter (card) ->
				card.matchesFilter filter

	class CardView extends Backbone.View
		tagName: 'li'
		className: 'card'

		template: _.template '<a href="<%= url %>" class="clearfix" target="_blank">' +
			'<div class="flags clearfix"><% _.each(flags, function(flagName) { %> <span class="flag <%= flagName %>"></span> <% }); %></div>' +
			'<div class="name"><%= name %></div>' +
			'<div class="badges">' +
			'<% if(dueDate) { %><div class="badge due"><span class="app-icon small-icon date-icon"></span><%= dateFormat(dueDate,"mmm d") %></div><% } %>' +
			'</div><div class="subscript">' +
			'Last action: <%= lastActionUser %> <%= lastActionDate %> | <span class="list"><%= listName %></span></div>' +
			'</a>'

		dueDateFlagsShades:
			'due-past': 'light'
			'due-now': 'light'
			'due-soon': 'light'
			'due-future': ''

		render: ->
			@$el.html(@template @model.toJSON())

			@$('.badge.due').addClass @model.dueDateFlag()

			@$('.badge.due .app-icon')
				.addClass( if @dueDateFlagsShades[@model.dueDateFlag()] then  @dueDateFlagsShades[@model.dueDateFlag()] else '')

			return this

	class Board extends Backbone.Model
		initialize: ->
			@cards = new CardList()

		addCard: (card) ->
			@cards.add card

	class BoardList extends Backbone.Collection
		model: Board

	class BoardView extends Backbone.View
		tagName: 'div'
		className: 'board'

		template: _.template '<a href="<%= url %>" class="header"><%= name %></a><ul class="cards"></ul><div class="loading_dots">' +
				'<span></span>' +
				'<span></span>' +
				'<span></span>' +
				'</div>'

		initialize: ->
			@cardViews = {};
			@model.cards.bind 'all', @render
			@options.filter.bind 'change', @render

		getCardView: (card) ->
			if !@cardViews[card.id]
				@cardViews[card.id] = new CardView(
					model: card
				)
			this.cardViews[card.id]

		render: =>
			boardView = @
			@$el.html this.template(@model.toJSON())

			@$('.cards').empty()
			cards = @model.cards.filtered(@options.filter)
			cards.each (card) ->
				boardView.$('.cards').append(boardView.getCardView(card).render().el)

			if cards.size() is 0 then @$el.addClass 'noCards' else @$el.removeClass 'noCards'
			return @

	class App extends Backbone.View
		options:
			cardActions: 'commentCard,createCard,updateCard,createList,addMemberToCard,removeMemberFromCard'

		initialize: ->
			app = @

			@boards = new BoardList();
			@boards.bind 'add', this.boardAdded

			@bind 'usersCardsLoaded', ->
				app.$el.addClass("loaded")

			@userData = null
			@lists = []

			@initFilter()
			@loadData()

		initFilter: ->
			@filter = new Filter
				id: 'main'
			@filter.fetch()

		render: ->
			filterView = new FilterView
				el: @$('.filter')
				model: @filter
			filterView.render()
			@

		boardAdded: (board) =>
			view = new BoardView
				model: board
				filter: @filter
			@$('.boards .loading').hide()
			@$('.boards').append(view.render().el)

		loadData: ->
			app = @

			Trello.get "members/me?actions=commentCard&boards=open&notifications=mentionedOnCard&board_fields=name,closed,url", (myData) ->

				app.userData = myData;

				_.each myData.boards, (board) ->
					app.boards.add(board)

				app.loadUsersCards()

		loadUsersCards: ->
			app = @

			console.time "members load"
			Trello.get "members/me/cards/open?actions=" + app.options.cardActions, (cards) ->
				console.time "cards" 
				console.timeEnd "members load"

				listIds = []
				boardsCards = {}

				 ## group by boards and separate list ids
				_.each cards, (card) ->
					if !boardsCards[card.idBoard]
					 	boardsCards[card.idBoard] = []

					card.flags = ['assignedToUser']
					boardsCards[card.idBoard].push card
					listIds.push card.idList

				_.each boardsCards, (cards, idBoard) ->
					board = app.boards.get idBoard
					if !board
						console.log 'board' + idBoard + ' not found'
						return
					return board.cards.reset cards

				app.loadMentions()
				app.loadCommentedCards()

				app.trigger 'usersCardsLoaded'

				_.chain(listIds)
					.unique()
					.each(_.bind(app.loadList, app))

				console.timeEnd "cards"

		loadMentions: ->
			app = @
			_.each @userData.notifications, (notification) ->
				board = app.boards.get notification.data.board.id
				if !board
					console.log 'board ' + notification.data.board.id + ' not found'
					return

				card = board.cards.get notification.data.card.id
				if card
					card.addFlag 'userMention'
					return

				Trello.get 'cards/' + notification.data.card.id + '?actions=' + app.options.cardActions, (card) ->
					card.flags = ['userMention']
					board.addCard card
					app.loadList card.idList

		loadCommentedCards: ->
			app = @
			_.each this.userData.actions, (action) ->
				board = app.boards.get action.data.board.id
				if !board
					console.log 'board ' + action.data.board.id + ' not found'
					return

				card = board.cards.get action.data.card.id
				if card
					card.addFlag 'commentedByUser'
					return

				Trello.get 'cards/' + action.data.card.id + '?actions=' + app.options.cardActions, (card) ->
					card.flags = ['commentedByUser']
					board.addCard card
					app.loadList card.idList

		loadList: (idList) ->
			app = @
			list = _.find this.lists, (list) ->
				list.id == idList

			if list
				$.publish 'listLoaded', list
				return

			Trello.get 'lists/' + idList, (list) ->
				app.lists.push list
				$.publish "listLoaded", list

	window.TrelloApp = App






			




			




