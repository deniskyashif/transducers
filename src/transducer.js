
const State = require('./state');

module.exports = {
    init: iterableDict => {
        if (!iterableDict) {
            throw new Error('The input dictionary should be defined.');
        }
    
        const transducer = createEmptyTransducer();
        constructTrie(transducer, iterableDict);
        performCanonicalLmlsExtension(transducer);
    
        return apiOf(transducer);
    },
    initAsync: async asyncIterableDict => {
        if (!asyncIterableDict) {
            throw new Error('The input dictionary should be defined.');
        }

        const transducer = createEmptyTransducer();
        await constructTrieAsync(transducer, asyncIterableDict);
        performCanonicalLmlsExtension(transducer);
    
        return apiOf(transducer);
    }
};

function createEmptyTransducer() {
    return {
        inputAlphabet: new Set(),
        startState: new State(),
        numberOfStates: 1
    };
}

function apiOf(transducer) {
    return {
        inputAlphabet: () => [...transducer.inputAlphabet],
        stateCount: () => transducer.numberOfStates,
        transitionCount: () => transducer.numberOfStates * transducer.inputAlphabet.size,
        process: word => process(transducer, word)
    };
}

function process(transducer, word) {
    let output = '';
    let state = transducer.startState;

    for (let symbol of word) {
        const transition = state.processTransition(symbol);

        if (transition) {
            output += transition.output;
            state = transition.next;
        }
        // In case an unknown symbol is read
        else {
            output += (state.output + symbol);
            state = transducer.startState;
        }
    }

    return output + state.output;
}

function constructTrie(transducer, iterableInputDict) {
    for (let entry of iterableInputDict) {
        addTrieEntry(transducer, entry);
    }
}

async function constructTrieAsync(transducer, asyncIterableInputDict) {
    for await (let entry of asyncIterableInputDict) {
        addTrieEntry(transducer, entry);
    }
}

function addTrieEntry(trie, entry) {
    let state = trie.startState;

    for (let symbol of entry.input) {
        const transition = state.processTransition(symbol);

        if (transition) {
            state = transition.next;
        } else {
            const newState = new State();
            state.setTransition(newState, symbol);
            state = newState;

            trie.inputAlphabet.add(symbol);
            trie.numberOfStates++;
        }
    }

    state.isFinal = true;
    state.output = entry.output;
}

function performCanonicalLmlsExtension(transducer) {
    const queue = [];
    transducer.startState.isFinal = true;
    transducer.startState.output = '';

    for (let symbol of transducer.inputAlphabet) {
        const transition = transducer.startState.processTransition(symbol);

        if (!transition) {
            transducer.startState.setTransition(transducer.startState, symbol, symbol);
        } else {
            queue.push({
                state: transition.next,
                prev: transducer.startState,
                output: transition.next.isFinal ? transition.next.output : symbol
            });
        }
    }

    while (queue.length) {
        complementState(transducer, queue.shift(), queue);
    }
}

function complementState(transducer, triple, queue) {
    const { state, prev, output } = triple;

    for (let symbol of transducer.inputAlphabet) {
        const transition = state.processTransition(symbol);
        const prevTransition = prev.processTransition(symbol);

        if (!transition) {
            state.setTransition(prevTransition.next, symbol, output + prevTransition.output);
        } else {
            if (transition.next.isFinal) {
                queue.push({
                    state: transition.next,
                    prev: transducer.startState,
                    output: transition.next.output
                });
            } else {
                queue.push({
                    state: transition.next,
                    prev: prevTransition.next,
                    output: output + prevTransition.output
                });
            }
        }
    }

    state.isFinal = true;
    state.output = output + prev.output;
}