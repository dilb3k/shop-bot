class StateManager {
  constructor() {
    this.validStateTypes = ["seller", "chat", "rating", "contact", "editProduct", "filter", "orderFilter", "admin"];
    this.states = {
      seller: {},
      chat: {},
      rating: {},
      contact: {},
      editProduct: {},
      filter: {},
      orderFilter: {},
      admin: {}, // Added admin state type for category rejection reasons
    };
  }


  getState(type, chatId) {
    return this.states[`${type}_${chatId}`];
  }

  setState(type, chatId, state) {
    this.states[`${type}_${chatId}`] = state;
  }

  clearState(type, chatId) {
    delete this.states[`${type}_${chatId}`];
  }

  getAllStates(type) {
    const result = {};
    for (const key in this.states) {
      if (key.startsWith(`${type}_`)) {
        const chatId = key.split("_")[1];
        result[chatId] = this.states[key];
      }
    }
    return result;
  }




  setState(type, chatId, state) {
    if (!this.validStateTypes.includes(type)) {
      console.error(`Invalid state type: ${type}`);
      throw new Error(`Invalid state type: ${type}`);
    }
    if (!chatId || typeof chatId !== "string") {
      console.error(`Invalid chatId: ${chatId}`);
      throw new Error(`Invalid chatId: ${chatId}`);
    }
    if (!this.states[type]) {
      this.states[type] = {};
    }
    this.states[type][chatId] = state;
    console.log(`State set for type: ${type}, chatId: ${chatId}, state:`, state);
  }

  getState(type, chatId) {
    if (!this.validStateTypes.includes(type)) {
      console.error(`Invalid state type: ${type}`);
      return null;
    }
    if (!chatId || typeof chatId !== "string") {
      console.error(`Invalid chatId: ${chatId}`);
      return null;
    }
    const state = this.states[type] && this.states[type][chatId];
    console.log(`State retrieved for type: ${type}, chatId: ${chatId}, state:`, state);
    return state;
  }

  clearState(type, chatId) {
    if (!this.validStateTypes.includes(type)) {
      console.error(`Invalid state type: ${type}`);
      return;
    }
    if (!chatId || typeof chatId !== "string") {
      console.error(`Invalid chatId: ${chatId}`);
      return;
    }
    if (this.states[type] && this.states[type][chatId]) {
      delete this.states[type][chatId];
      console.log(`State cleared for type: ${type}, chatId: ${chatId}`);
    }
  }

  clearAllStates(chatId) {
    if (!chatId || typeof chatId !== "string") {
      console.error(`Invalid chatId: ${chatId}`);
      return;
    }
    Object.keys(this.states).forEach((type) => {
      this.clearState(type, chatId);
    });
    console.log(`All states cleared for chatId: ${chatId}`);
  }
}

module.exports = new StateManager();