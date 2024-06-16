<script setup lang="ts">
import WelcomeItem from './WelcomeItem.vue'
import SortIcon from './icons/IconSort.vue'
import GetIcon from './icons/IconGet.vue'
import GenIcon from './icons/IconGen.vue'
import SupportIcon from './icons/IconSupport.vue'
import { MDBRange, MDBBtn, MDBInput } from "mdb-vue-ui-kit";
import { ref } from "vue";

const range1 = ref(100);
const unsortedLink = ref("");
const sortedLink = ref("");
const takenTime = ref(0);
</script>

<template>

  <WelcomeItem>
    <template #icon>
      <GenIcon />
    </template>
    <template #heading>Gen</template>
    <h3>Generate Dataset</h3>
    <div>



      <MDBRange label="Number of Events in thousands" v-model="range1" :min="1" :max="2000" :step="1" />

      <MDBInput inputGroup :formOutline="false" wrapperClass="mb-3" v-model="range1"
        aria-label="Number of Events in thousands" aria-describedby="button-addon1">
        <template #prepend>
          <MDBBtn outline="primary" id="button-addon1" :ripple="{ color: 'dark' }">
            Generate
          </MDBBtn>
        </template>
      </MDBInput>
    </div>
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <SortIcon />
    </template>
    <template #heading>Sort</template>
    <h3>Sort Events</h3>
    <div>
      <MDBBtn color="success">Sort</MDBBtn>
    </div>
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <GetIcon />
    </template>
    <template #heading>Get</template>
    <h3>Review Dataset</h3>
    <div>
      <MDBBtn color="secondary">Unsorted</MDBBtn>
      <MDBBtn color="secondary">Sorted</MDBBtn>
    </div>
  </WelcomeItem>

  <WelcomeItem>
    <template #icon>
      <SupportIcon />
    </template>
    <template #heading>Contact</template>
    <h3>Interested?</h3>
    <p>
      Let's chat
    </p>
  </WelcomeItem>

</template>
