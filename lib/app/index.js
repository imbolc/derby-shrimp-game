var app = require('derby').createApp(module)
    .use(require('../../ui'))


app.get('*', function(page, model, params, next) {
    model.fetch('users', function (err) {
        if (err) { next(err); }

        var userId = model.get('_session.userId');
        model.ref('_page.user', 'users.' + userId);
        if (!model.get('_page.user.id')) {
            model.set('_page.user.id', userId);
        }
        next();
    });
});


app.get('/', function(page, model, params, next) {
    model.fetch('games', function (err) {
        if (err) { next(err); }

        var user = model.get('_page.user');
        var game = findCurrentGame(user) || findNotFullGame(user) || createGame(user);
        model.ref('_page.game', 'games.' + game.id);
        model.set('_page.playerNumber', game.players.indexOf(user.id) + 1);
        model.subscribe('games.' + game.id, function (err) {
            if (err) { next(err); }
            page.render();
        });

    });

    function findCurrentGame(user) {
        var game = model.filter('games', function (game) {
            return ~game.players.indexOf(user.id) && !game.isFinished;
        }).get();
        return game.length ? game[0] : null;
    }

    function findNotFullGame(user) {
        var game = model.filter('games', function (game) {
            return game.players.length < 3;
        }).sort(function (a, b) {
            return a.created > b.created;
        }).get();
        game = game.length ? game[0] : null;
        if (game) {
            model.push('games.' + game.id + '.players', user.id);
        }
        return game;
    }

    function createGame(user) {
        var game = {
            players: [user.id],
            history: [],
            round  : {quantity: {}},
            created: new Date().getTime()
        };
        game.id = model.add('games', game);
        return game;
    }
});

app.enter('/', function (model) {
    var costPerPound = 5;

    app.fn('submitQuantity', function () {
        var quantity = model.get('_page.quantity');
        var user = model.get('_page.user');
        var round = model.get('_page.game.round');

        if (typeof quantity !== "undefined") {
            model.set('_page.quantity', undefined);
            model.set('_page.game.round.quantity.' + user.id, parseInt(quantity));
            if (Object.keys(round.quantity).length == 3) {
                roundComplete();
            }
        }

        function roundComplete() {
            var price = calculatePrice();
            model.set('_page.game.round.price', price);
            model.set('_page.game.round.profit', calculateProfit(price));
            model.push('_page.game.history', round);
            model.set('_page.game.round', {quantity: {}});
        }

        function calculatePrice() {
            var sum = Object.keys(round.quantity).reduce(function (a, b) {
                return a + round.quantity[b];
            }, 0);
            return 45 - 0.2 * sum;
        }

        function calculateProfit(price) {
            var profit = {};
            for (key in round.quantity) {
                profit[key] = round.quantity[key] * (price - costPerPound);
            }
            return profit;
        }
    });
});
