<script setup lang="ts">
import {
  MDBTable
} from 'mdb-vue-ui-kit';
</script>

<template>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700,900&display=swap" rel="stylesheet" />
<div class="spacer2"></div>
  <div class="greetings"  data-mdb-theme="dark">
    <div class="headlines">
      <h1 >Osortier</h1>
    </div>
    <p>
      This is a demo of a high performance event sorting algorithm.<br>
      Event sorting is a hard problem, however I can offer you a high throughput and ultra low cost solution.<br>
      <br>
    <h2 >Performance</h2><br>
    <div class="headlines">
      <b>5 million events per minute</b> <br>
      or about<br>
      <b>7.2 billion events per day</b> <br>
      using <br>
      <b>1 core and 2GB of RAM</b>
      <br>
      at a cost of <br>
      <b>about 0,28$ per month on AWS</b>
      <br>assuming 30 mio. events per day<br>
      <br>

      Yes, you read correctly: about 28 cents per month.
      <br><br>
    </div>
    <h2 >How it works</h2>
    <MDBTable>


      <tbody>
        <tr class="headlines">
          <th scope="row">Consume from</th>
          <td>S3 | Kafka | Pub/Sub | SQS</td>

        </tr>
        <tr class="headlines">
          <th scope="row">Process</th>
          <td>in chunks of <br> 2 - 16.000.000 events</td>

        </tr>
        <tr class="headlines">
          <th scope="row">Produce to</th>
          <td>S3 | Kafka | Pub/Sub | SQS | DB</td>

        </tr>
        <tr class="headlines">
          <th scope="row">cost</th>
          <td>0,00031$ per million |
            0,28$ for 900 million</td>

        </tr>
      </tbody>
    </MDBTable>
    <h2 >Cost breakdown</h2>
    Cost example for this demo hosted on AWS with Lambda, additional API Gateway and Lambda cost is around 0,24$ for the same time period of 1 month and 900 million events.
    <MDBTable>
      <tbody>
        <tr class="headlines">
          <th scope="row">Cost per GB and second</th>
          <td>0,0000133334$</td>

        </tr>
        <tr class="headlines">
          <th scope="row">Events per Month</th>
          <td>900.000.000</td>

        </tr>
        <tr class="headlines">
          <th scope="row">Processed Events per Second</th>
          <td>83.333</td>

        </tr>
        <tr class="headlines">
          <th scope="row">Execution Time per Month</th>
          <td>10800s</td>

        </tr>
        <tr class="headlines">
          <th scope="row"><b>total cost</b></th>
          <td>10800s * 0,0000133334$/(GB*s) * 2GB = <b>0,288$</b></td>

        </tr>
      </tbody>
    </MDBTable>
    </p>
  </div>



</template>

<style scoped>
.spacer2{
  height: 3em;
}

.headlines {

  text-align: center;
}

h1 {
  font-weight: 500;
  font-size: 2.6rem;
  position: relative;
  top: -10px;
}

h3 {
  font-size: 1.2rem;
}

.greetings h1,
.greetings h3 {
  text-align: center;
}

@media (min-width: 1024px) {

  .greetings h1,
  .greetings h3 {
    text-align: left;
  }
}
</style>
