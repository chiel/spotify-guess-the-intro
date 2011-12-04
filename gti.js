/**
 * 1. Make a set of tracks based on all the user's playlists, and add rick astley (the pool).
 * 2. The game in total lasts 5 minutes, each round lasts 20sec (or so).
 * 3. Each round picks 4 tracks at random from the pool and removes the correct answer from the pool
 * 		- Present the options
 * 		- Play the track
 * 		- Score for each round is multiplier x time left in the current round
 * 		- Guess correctly increases multiplier by 1, otherwise reset
 *
 * If you get a wrong answer, it will disable that answer, and decrease the time left by a quarter of the total round time
 *
 * @author Chiel Kunkels <chiel@kunkels.me>
 */
"use strict";

exports.init = init;

// Import the Spotify API
sp = getSpotifyApi(1);
var m = sp.require('sp://import/scripts/api/models'),
	v = sp.require('sp://import/scripts/api/views');

// Default options
var gameTime = 5 * (60 * 1000), // in milliseconds
	roundTime = 20000, // in milliseconds
	maxRoundScore = 30, // maximum score to be had in a round
	initialMultiplier = 1,
	maxMultiplier = 8;

// Global properties
var pool = [],
	gameTimeRemaining = gameTime,
	pastRounds = [],
	currentRound,
	score = 0,
	multiplier = initialMultiplier,
	// multiplierEl = $('multiplier'),
	roundTimer;

/**
 * Grab the user's library and start the game!
 */
function init()
{
	// Make sure people can't use playback control, and hide metadata
	if (sp.trackPlayer.setHidesNowPlayingMetadata) {
		sp.trackPlayer.setHidesNowPlayingMetadata(true);
	}
	if (sp.trackPlayer.setAllowsPlaybackControl) {
		sp.trackPlayer.setAllowsPlaybackControl(false);
	}

	document.getElement('#startscreen .newgame').addEvent('click', gameStart);
}

/**
 * When a game starts
 */
function gameStart()
{
	$('startscreen').addClass('hidden');

	// Pie timer
	roundTimer = $('roundtimer').getElement('svg path');

	// Get all tracks in a user's library
	pool = m.library.tracks;

	// Add Rick Astley for fun and profit...
	m.Track.fromURI('spotify:track:6JEK0CvvjDjjMUBFoXShNZ', function(track) {
		if (pool.indexOf(track) !== -1) {
			pool.push(track);
		}
		showMainUI();
	});

	window.addEvent('unload', function() {
		if (currentRound) {
			currentRound.end(false);
		}
	});

	// Attach an event to check for keypresses
	window.addEventListener('keydown', function(e) {
		// Check if there's currently a round going on
		if (currentRound && currentRound instanceof Round) {
			switch (e.keyCode) {
				case 49: currentRound.choose(0); break;
				case 50: currentRound.choose(1); break;
				case 51: currentRound.choose(2); break;
				case 52: currentRound.choose(3); break;
			}
		}
	});

	// Check when playstate is changed
	m.player.observe(m.EVENT.CHANGE, function(e) {
		if (e.data.playstate && m.player.playing && currentRound) {
			currentRound.playbackStart();
		}
	});
}

function gameEnd()
{
	console.log('end LE GAME');
}

/**
 * Shows the main UI
 */
function showMainUI()
{
	var header = document.getElement('header');
	setTimeout(function() {
		newRound();
	}, 500);
	document.getElement('header').removeClass('hidden');
}

/**
 * Start a new round and store the previous one
 */
function newRound()
{
	if (currentRound) {
		pastRounds.push(currentRound);
	}
	currentRound = new Round();
}

/**
 *
 */
function updateTimer(timeRemaining)
{
	var ps = ((roundTime - timeRemaining) / roundTime) - 0.25,
		r = 40, d = 0,
		x = r * Math.cos(Math.PI * 2 * ps) + 50,
		y = r * Math.sin(Math.PI * 2 * ps) + 50;

	if (x < 50) {
		d = 1;
	}

	var d = 'M50,50 L50,10 A40,40 0 '+d+',1 '+x+','+y+' z';
	roundTimer.set('d', d);

	var minutes = Math.floor((gameTimeRemaining / 1000) / 60);
	var seconds = Math.floor((gameTimeRemaining / 1000) - (minutes * 60));
	$('timer').getElement('.time').set('text', minutes+':'+(seconds < 10 ? '0' : '')+seconds);
}

/**
 *
 */
function updateMultiplier()
{
	console.log('updating multiplier', multiplier);
	var elem = $('multiplier');
	elem.toggleClass('shaking', multiplier >= 20);
	elem.getElement('.count').set('text', multiplier);

	if (multiplier > 1) {
		console.log($('multiplier').removeClass('hidden'));
	}
}





/**
 *
 */
var Round = new Class({
	chosen: false,
	choices: [],
	correctIndex: -1,
	wrapper: null,
	elements: [],
	disabledChoices: [],
	timeRemaining: roundTime,
	roundScore: 0,
	playing: false,

	/**
	 *
	 */
	initialize: function()
	{
		this.getChoices();
		this.build();
		this.start();
	},

	/**
	 *
	 */
	getChoices: function()
	{
		var attempts = 0;
		// Get 4 choices from the pool and save them in this round
		while(this.choices.length < 4 && attempts < 50) {
			var track = pool[Math.floor(Math.random() * pool.length)];
			if (this.choices.indexOf(track) === -1 && track.data.availableForPlayback) {
				this.choices.push(track);
			}
			attempts++;
		}

		// Grab a random item from the choices, which is the correct choice
		this.correctIndex = Math.floor(Math.random() * this.choices.length);

		// Remove the correct choice from the pool
		pool.splice(pool.indexOf(this.choices[this.correctIndex]), 1);
	},

	/**
	 *
	 */
	build: function()
	{
		this.wrapper = new Element('ul.choices.round-'+currentRound);
		this.wrapper.addEvent('click', function(e) {
			var li = e.target;
			if (li.get('tag') !== 'li') {
				li = e.target.getParent('li');
			}
			this.choose(li.retrieve('index'));
		}.bind(this));

		var self = this;
		for (var i = 0; i < this.choices.length; i++) {
			var track = this.choices[i];
			var el = new Element('li');
			el.store('index', i);
			el.adopt(
				new v.Image(track.data.album.cover).node,
				new Element('div.track', {html: track.data.name}),
				new Element('div.artist', {html: track.data.artists[0].name}),
				new Element('div.number', {html: i + 1})
			);

			// Save the element
			this.elements.push(el);
			this.wrapper.adopt(el);
		};

		this.wrapper.inject(document.getElement('#body .margin'));
	},

	/**
	 *
	 */
	start: function()
	{
		m.player.play(this.choices[this.correctIndex]);
	},

	/**
	 *
	 */
	playbackStart: function()
	{
		this.playing = true;

		this.timerInterval = setInterval(function() {
			this.timeRemaining -= 100;
			gameTimeRemaining -= 100;
			updateTimer(this.timeRemaining);
			this.lastTimer = new Date();
			if (gameTimeRemaining <= 0) {
				this.failure();
				gameEnd();
			}
			if (this.timeRemaining <= 0) {
				multiplier = 1;
				updateMultiplier();
				updateTimer(1);
				this.end(true);
			}
		}.bind(this), 100);
	},

	/**
	 *
	 */
	choose: function(index)
	{
		if (!this.playing && this.chosen) { return; }

		if (index === this.correctIndex) {
			this.success();
		} else if (this.disabledChoices.indexOf(index) === -1) {
			this.failure();
		}
	},

	/**
	 *
	 */
	success: function(index)
	{
		console.log('GREAT SUCCESS!');

		if (this.timeRemaining > 0) {
			this.timeRemaining -= new Date() - this.lastTimer;
			gameTimeRemaining -= new Date() - this.lastTimer;
			this.roundScore = Math.ceil((maxRoundScore / roundTime) * this.timeRemaining * multiplier);
			score += this.roundScore;
			document.getElement('#score .count').set('text', score);
		}
		multiplier++;
		updateMultiplier();
		this.end(true);
	},

	/**
	 *
	 */
	failure: function(index)
	{
		console.log('failure');
		this.choiceEls[index].classList.add('inactive');
		this.disabledChoices.push(index);
		multiplier = 1;
		updateMultiplier();

		this.timeRemaining -= (roundTime / 3);
		if (this.timeRemaining <= 0) {
			updateTimer(1);
			this.end(true);
		} else {
			updateTimer(this.timeRemaining);
		}
	},

	/**
	 *
	 */
	end: function(startNewRound)
	{
		console.log('end');
		clearInterval(this.timerInterval);
		m.player.playing = false;

		this.wrapper.dispose();
		if (startNewRound) {
			setTimeout(function() {
				newRound();
			}, 2000);
		}
	}

});

