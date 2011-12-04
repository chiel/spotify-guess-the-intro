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
	maxRoundScore = 300, // maximum score to be had in a round
	initialMultiplier = 1,
	maxMultiplier = 8;

// Global properties
var pool = [],
	gameTimeRemaining = gameTime,
	pastRounds = [],
	currentRound,
	score = 0,
	multiplier = initialMultiplier;

/**
 * Grab the user's library and start the game!
 */
function init()
{
	// Get all tracks in a user's library
	pool = m.library.tracks;

	// Make sure people can't use playback control, and hide metadata
	if (sp.trackPlayer.setHidesNowPlayingMetadata && sp.trackPlayer.setAllowsPlaybackControl) {
		sp.trackPlayer.setHidesNowPlayingMetadata(true);
		sp.trackPlayer.setAllowsPlaybackControl(false);
	}

	// Add Rick Astley for fun and profit...
	m.Track.fromURI('spotify:track:6JEK0CvvjDjjMUBFoXShNZ', function(track) {
		if (pool.indexOf(track) !== -1) {
			pool.push(track);
		}
		build();
		newRound();
	});

	// Attach an event to check for keypresses
	window.addEventListener('keydown', function(e) {
		// Check if there's currently a round going on
		if (currentRound && currentRound instanceof Round) {
			switch (e.keyCode) {
				case 49: currentRound.choose(1); break;
				case 50: currentRound.choose(2); break;
				case 51: currentRound.choose(3); break;
				case 52: currentRound.choose(4); break;
			}
		}
	});

	// Check when playstate is changed
	m.player.observe(m.EVENT.CHANGE, function(e) {
		if (e.data.playstate && m.player.playing && currentRound) {
			currentRound.startTimer();
		}
	});
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
 * Build up the generic UI elements
 */
function build()
{
	//
}


/**
 * Each round is represented by a Round instance
 */
function Round()
{
	// Properties
	this.choices = [];
	this.choiceEls = [];
	this.disabledChoices = [];
	this.timeRemaining = roundTime;

	this.getChoices();
	this.displayChoices();
	this.start();
}

/**
 *
 */
Round.prototype.getChoices = function()
{
	// Get 4 choices from the pool and save them in this round
	for (var i = 0; i < 4; i++) {
		this.choices.push(pool[Math.floor(Math.random() * pool.length)]);
	}

	// Grab a random item from the choices, which is the correct choice
	this.correctChoice = Math.floor(Math.random() * this.choices.length);

	// Remove the correct choice from the pool
	var poolIndex = pool.indexOf(this.choices[this.correctChoice]);
	pool.splice(poolIndex, 1);
};

/**
 * Render the choices in the layout
 */
Round.prototype.displayChoices = function()
{
	this.wrapper = new Element('ul.choices.round-'+currentRound);

	var self = this;
	for (var i = 0; i < this.choices.length; i++) {
		var track = this.choices[i];
		var el = new Element('li');
		el.adopt(
			new v.Image(track.data.album.cover).node,
			new Element('div.track', {html: track.data.name}),
			new Element('div.artist', {html: track.data.artists[0].name})
		);

		// Save the element
		this.choiceEls.push(el);
		this.wrapper.adopt(el);
	};

	this.wrapper.inject($('body'));
};

/**
 * Start playback, this actually only starts loading the track
 */
Round.prototype.start = function()
{
	m.player.play(this.choices[this.correctChoice]);
};

/**
 * When playback actually starts, this is fired
 */
Round.prototype.startTimer = function()
{
	this.timer();
}

/**
 * Set an interval every second to handle the timer
 */
Round.prototype.timer = function()
{
	this.timerInterval = setInterval(function() {
		this.timeRemaining -= 1000;
		this.lastTimer = new Date();
		if (this.timeRemaining <= 0) {
			this.end();
		}
	}.bind(this), 1000);
};

/**
 * Choose something!
 */
Round.prototype.choose = function(number)
{
	var index = number - 1;
	// Check if it's the correct choice
	if (index === this.correctChoice) {
		console.log('GREAT SUCCESS!');
		this.end();
	}

	// Wrong choice
	else if (this.disabledChoices.indexOf(index) === -1) {
		this.choiceEls[index].classList.add('inactive');
		this.disabledChoices.push(index);

		this.timeRemaining -= (roundTime / 3);
		if (this.timeRemaining <= 0) {
			this.end();
		}
	}
};

Round.prototype.end = function()
{
	clearInterval(this.timerInterval);
	m.player.playing = false;

	if (this.timeRemaining > 0) {
		this.timeRemaining -= new Date() - this.lastTimer;
		this.roundScore = Math.ceil((maxRoundScore / roundTime) * this.timeRemaining);
		score += this.roundScore;
	}

	this.wrapper.dispose();
	newRound();
};
