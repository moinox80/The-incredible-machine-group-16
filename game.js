// Modules
const Five = require('johnny-five');
const Oled = require('oled-js');
const Font = require('oled-font-5x7');
const Wait = require('wait-for-stuff');

// Checking for events on the individual components
// each time sucks, so just make the components
// emit a unique event, which can be caught from
// anywhere in the program.
const {EventEmitter} = require('events');

// Game globals.
var gameEnd = false,
    hits = 0,
    opponentsKilled = 0,
    opponents = ['pikachu', 'eevee'];

// Instances
const board = new Five.Board({port: "COM10"});
const emitter = new EventEmitter();

// Sprites
const pokemon = require('./sprites/pokemon.js');
const sickle = require('./sprites/sickle.js');
const bag = require('./sprites/bag.js');

// Sounds
const anthem = require('./sounds/anthem.js');

// Arduino Components
var piezo, screens, buttons;

// Cursors Corresponding to Options
var currCursor = 0,
    currOption = 'attack',
    optionCursors = [
        [0,0],
        [0,9],
        [1,0]
    ],
    optionNames = [ 'attack', 'bag', 'run' ];

const actions = {
    attack: () => {
        let turn = attack();

        screens['opponent'].clearDisplay();
        // If returns true, then attack was successful.
        if(turn){
            hits++;

            if(hits === 3){

                hits = 0;
                opponentsKilled++;

                if(opponentsKilled === 2){
                    // If you've gone through all opponents,
                    // game is over.
                    emitter.emit('game-won');
                    return;
                } else {
                    screens['opponent'].setCursor(4, 4);
                    screens['opponent'].writeString(Font, 1, `${opponents[0]} has been stricken down. Here comes ${opponents[1]}!`, 1, true, 2);

                    // Remove the first item of the opponents list.
                    opponents.shift();
                }

            } else {
                screens['opponent'].setCursor(16, 28);
                screens['opponent'].writeString(Font, 1, `Attack hit!`, 1, true, 2);
                screens['opponent'].setCursor(16, 36);
                screens['opponent'].writeString(Font, 1, `${3-hits} hits left.`, 1, true, 2);
            }
        } else if(!turn){
            // If returns false, attack missed.
            screens['opponent'].setCursor(24, 28);
            screens['opponent'].writeString(Font, 1, 'Missed!', 1, true, 2);
        }
        
        screens['opponent'].update();

        Wait.for.time(1);

        drawOLED(pokemon[opponents[0]]);
    },
    // Bag
    bag: () => {
        drawOLED(bag, false);
    },
    // Run
    run: () => {
        gameEnd = true;

        screens['opponent'].clearDisplay();
        screens['opponent'].setCursor(16, 28);
        screens['opponent'].writeString(Font, 1, 'You ran away.', 1, true, 2);
        screens['opponent'].update();

        emitter.emit('game-lost');
    }
}

board.on('ready', () => {

    // Flag to check if the components are ready.
    let is_set_up = false;

    try {
        piezo = new Five.Piezo(5);

        buttons = {
            action: new Five.Button({
                pin: 2,
                isPullup: true
            }),
            cycle: new Five.Button({
                pin: 3,
                isPullup: true
            })
        }

        // Dynamically assign events.
        for(let btn in buttons){
            // Handy to have the name of the button assigned to it.
            buttons[btn]._name = btn;
            buttons[btn].on('press', function(){
                if(!gameEnd){
                    // Emitting an event means the button press,
                    // can be detected from any where in the program.
                    emitter.emit(btn);
                }
            });
        }
        // Store the screen structurally.
        screens = {
            action: new Five.LCD({
                pins: [7, 8, 9, 10, 11, 12],
                backlight: 13,
                rows: 2,
                cols: 16
            }),
            opponent: new Oled(board, Five, {
                width: 128,
                height: 64,
                address: 0x3C
            })
        }

        // Set the falg to true at the end.
        is_set_up = true;
    } catch(e){
        // Log any errors that occurred during set up.
        console.log('Error:', e);
    }

    // Close the program if there was a problem.
    if(!is_set_up){
        return console.log('There was a problem setting up.');
    }

    // Draw the initial instructions.
    screens['opponent'].clearDisplay();
    screens['opponent'].setCursor(4, 24);
    screens['opponent'].writeString(Font, 1, 'Red button to begin, yellow to scroll options.', 1, true, 2);
    screens['opponent'].update();

    // Add a nice scrolling visual.
    screens['opponent'].startScroll('left', 0, 15);

    // LCD title screen.
    screens['action'].clear()
        .cursor(0,3).print('Bootlegmon')
        .cursor(1,2).print('Continue >>>');

    // Wait for the action button to be pressed,
    // then begin the game.
    emitter.once('action', function(){
        startGame();
    });
});

board.on('close', () => {
    // Avoid prolonged beep.
    piezo.noTone().off();

    // Clear screens and print goodbye message.
    screens['action'].clear().home().print('Goodbye');
    screens['opponent'].clearDisplay();
    screens['opponent'].update();
});

// Catch any events during board set up.
// (This is usually an incorrectly set port.)
board.on('error', (err) => {
    // Hence, check print especially for COM port messages.
    if(err.message.includes('COM')){
        console.log('—————————————————\n Wrong port, bud\n—————————————————');
    }
    return console.log('Error:', err.message);
});

// Utility function to draw stuff to the OLED.
function drawOLED(sprite, invert = true){
    screens['opponent'].clearDisplay();

    // You have to create a copy of the sprite buffer,
    // because otherwise buffer will be set referencially
    // to the sprite, as opposed to a new buffer.

    // EcmaScript6 lets you destructure array values, then insert
    // the values into a new array to copy them.
    screens['opponent'].buffer = [...sprite];

    screens['opponent'].invertDisplay(invert);
    screens['opponent'].update();
}

// Draw the original options (useful if more menus are coded).
function drawActions(){
    screens['action'].clear()
    .home().print('1.Attack 2.Bag')
    .cursor(1,0).print('3.Run')
    .home().blink();
}

// Shows the user which option they
// are hovering over.
function cycleOptions(){
    currCursor += currCursor === 2 ? -2 : 1;
    currOption = optionNames[currCursor];

    screens['action'].cursor(...optionCursors[currCursor]).blink();
}

// Execute the function corresponding to
// the selected action menu option.
function selectOption(){
    actions[currOption]();
}

// Perform an attack sequence.
function attack(){
    // To make it slightly more interesting,
    // generate a random number...
    let r = Math.floor((Math.random() * 10) + 1);

    // ...and give a 10% chance to miss.
    if(r === 1){
        return false;
    }

    // If you didn't miss, attack (add one to the total hits inflicted).
    return true;

}

function gameWon(){
    for(btn in buttons){
        // Effectively removes event listener. Can't use
        // removeListener, since functions aren't named.
        buttons[btn].on('press', () => {});
    }

    Wait.for.time(.5);

    // Draw glorious emblem.
    drawOLED(sickle);

    // Congratulate the user.
    screens['action'].clear()
        .home().print('Game Over. Well')
        .cursor(1,0).print('played, comrade.');

    // Советская Гимн.
    anthem(piezo);
}

function gameLost(){
    for(btn in buttons){
        // Effectively removes event listener. Can't use
        // removeListener, since functions aren't named.
        buttons[btn].on('press', () => {});
    }

    screens['action'].clear()
        .home().print('Game Over. You')
        .cursor(1,0).print('are disgrace.');
}

function startGame(){
    // Prep screens.
    screens['opponent'].stopScroll();

    drawOLED(pokemon[opponents[0]]);
    drawActions();

    // Catch events.
    emitter.on('cycle', cycleOptions);
    emitter.on('action', selectOption);

    emitter.on('game-won', gameWon);
    emitter.on('game-lost', gameLost);
}
