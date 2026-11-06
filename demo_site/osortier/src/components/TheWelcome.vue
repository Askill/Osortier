<script setup lang="ts">
import WelcomeItem from './WelcomeItem.vue'
import SortIcon from './icons/IconSort.vue'
import GetIcon from './icons/IconGet.vue'
import GenIcon from './icons/IconGen.vue'
import SupportIcon from './icons/IconSupport.vue'
import { MDBRange, MDBBtn, MDBInput, MDBSpinner } from "mdb-vue-ui-kit";
import { ref } from "vue";

const range1 = ref(10000);
const sessionID = Math.random().toString(16).slice(2);
const unsortedLink = ref("");
const sortedLink = ref("");
const sorting = ref(false);
const generating = ref(false);
const takenTime = ref(0);

import axios from 'axios';



function genEvents() {
  const eventsUrl = `/prod/events?session=${sessionID}&num=${range1.value}`;
  generating.value = true
  axios.post(eventsUrl)
    .then((response: { data: any }) => {
      unsortedLink.value = `https://osortiereventstore.s3.eu-central-1.amazonaws.com/${sessionID}/unsorted_session_data.json`;
      generating.value = false
    })
    .catch((error: any) => {
      console.error('Error fetching data:', error);
      generating.value = false
    });
}

function sortEvents() {
  const sortUrl = `/prod/sort?session=${sessionID}&num=${range1.value}`;
  sorting.value = true
  axios.post(sortUrl)
    .then((response: { data: any }) => {
      sortedLink.value = `https://osortiereventstore.s3.eu-central-1.amazonaws.com/${sessionID}/sorted_events.json`;
      sorting.value = false
    })
    .catch((error: any) => {
      console.error('Error fetching data:', error);
      sorting.value = false
    });
}
</script>

<template>

  <WelcomeItem>
    <template #icon>
      <GenIcon />
    </template>
    <template #heading>Gen</template>

    <h3>1. Generate Dataset</h3>
    <div>



      <MDBRange label="Number of Events" v-model="range1" :min="1000" :max="2000000" :step="1000" />

      <MDBInput inputGroup :formOutline="false" wrapperClass="mb-3" v-model="range1"
        aria-label="Number of Events" aria-describedby="button-addon1">
        <template #prepend>

          <MDBBtn outline="primary" id="button-addon1" :ripple="{ color: 'dark' }" @click="genEvents">
            <MDBSpinner v-if="generating" size="sm" grow color="primary" />
            Generate

          </MDBBtn>
        </template>
      </MDBInput>
    </div>

    The dataset contains stock movement events from one "account" to the other, so from account a to account b, each of the transactions on one account has a sequence number. <br>
      One stock movement can only be "booked" once all previous transactions on that account have been settled. <br><br>

      One movement would look like this:<br>
      a0 -> b5, assuming b 0-5 have been processed<br><br>

      If one event is received out of order, like a3 -> b6, all events on any following account, like accounts b <b>and c</b> would be blocked as well.<br>
      a3 -> b6 <br>
      a1 -> b7 <br>
      a2 -> c0 <br>
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <SortIcon />
    </template>
    <br>
    <h3>2. Sort Events</h3>
    <div>
      <MDBBtn v-if="unsortedLink" @click="sortEvents" color="primary">Sort</MDBBtn>
      <MDBBtn v-else color="secondary" aria-disabled="true">Sort</MDBBtn>
      <MDBSpinner v-if="sorting" grow color="primary" />
    </div>
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <GetIcon />
    </template>
    <br>
    <h3>3. Review Dataset</h3>
    <div>
      <a :href=sortedLink v-if="unsortedLink" target="_blank">
        <MDBBtn color="primary">Unsorted</MDBBtn>
      </a>
      <a v-else>
        <MDBBtn color="secondary">Unsorted</MDBBtn>
      </a>
      <a :href=sortedLink v-if="sortedLink" target="_blank">
        <MDBBtn color="primary" aria-disabled="true">Sorted</MDBBtn>
      </a>
      <a v-else>
        <MDBBtn color="secondary" aria-disabled="true">Sorted</MDBBtn>
      </a>
    </div><br>
    <div>Feel free to review the code for the generation and validation of the events: <a href="https://gist.github.com/Askill/62d18a0eed988fc886d5267fc97d461a">Source</a></div>
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <SupportIcon />
    </template>
    <br>
    <h3>4. Interested?</h3>
    <p>
      <a href="https://www.patricematz.de/Links" target="_blank">Let's chat</a><br>

      <a href="mailto:mail@patricematz.de" target="_blank">Mail</a> <br>
      <a href="https://www.linkedin.com/in/patrice-matz-b73b6814a/" target="_blank">LinkedIn</a>
    </p>
  </WelcomeItem>

</template>

<style>      
.spacer{
  height: 0em;
}

</style>