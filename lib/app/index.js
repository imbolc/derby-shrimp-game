var app = require('derby').createApp(module)
        .use(require('../../ui')),
    view = app.view;


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
        //model.ref('_page.game', 'games.' + game.id);
        //model.set('_page.playerNumber', game.players.indexOf(user.id) + 1);
        //model.set('_page.quantity', 0);
        model.subscribe('games.' + game.id, function (err) {
            if (err) { next(err); }
            //page.render();
            page.redirect('/game-' + game.id);
        });

    });

    function findCurrentGame(user) {
        var game = model.filter('games', function (game) {
            return ~game.players.indexOf(user.id) && game.history.length < 8;
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
            round  : {num: 1, quantity: {}},
            created: new Date().getTime()
        };
        game.id = model.add('games', game);
        return game;
    }

});


app.get('/game-:gameId', function (page, model, params, next) {
    model.subscribe('games.' + params.gameId, function (err) {
        if (err) { next(err); }

        var user = model.get('_page.user'),
            game = model.get('games.' + params.gameId);
        model.ref('_page.game', 'games.' + game.id);
        model.set('_page.playerNumber', game.players.indexOf(user.id) + 1);
        model.set('_page.quantity', 0);
        page.render('game');
    });
});


app.fn('submitQuantity', function () {
    var model = this.model,
        costPerPound = 5,
        round = model.get('_page.game.round');

    model.set('_page.game.round.quantity.' + model.get('_page.user').id,
        parseInt(model.get('_page.quantity')));
    if (Object.keys(round.quantity).length == 3) {
        roundComplete();
    }

    function roundComplete() {
        var price = calculatePrice();
        model.set('_page.game.round.price', price);
        calculateProfit(price);
        model.push('_page.game.history', round);
        model.set('_page.game.round', {
            num: round.num + 1,
            quantity: {}
        });
    }

    function calculatePrice() {
        var sum = Object.keys(round.quantity).reduce(function (a, b) {
            return a + round.quantity[b];
        }, 0);
        return 45 - 0.2 * sum;
    }

    function calculateProfit(price) {
        for (key in round.quantity) {
            var profit = round.quantity[key] * (price - costPerPound);
            model.set('_page.game.round.profit.' + key, profit);
            model.increment('_page.game.totalProfit.' + key, profit);
        }
    }
});


view.fn('toFixed', function (value) {
    value = value || 0;
    return value.toFixed(2);
});


view.fn('getCurrentRound', function (game) {
    return game.history.length + 1;
});


view.fn('isQuantitySubmitted', function (user, game) {
    return user.id in game.round.quantity;
});


view.fn('isMeWinner', function (user, game) {
    if (~game.players.indexOf(user.id)) {
        var myProfit = game.totalProfit[user.id];
        for (key in game.totalProfit) {
            if (game.totalProfit[key] > myProfit) {
                return;
            }
        }
        return true;
    };
});
