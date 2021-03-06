'use strict';
const addyInput = document.getElementById('addy_input');
const dropdown = document.getElementsByClassName('dropdown-menu')[0];
const button = document.getElementsByClassName('link')[0];
let checkedAddy;
let lowerCaseAddy;

addyInput.addEventListener('input', (input) => {
  try {
    if (addyInput.value !== '' && addyInput.value.length === 42) {
      let userInput = addyInput.value;
      checkedAddy = ethers.utils.getAddress(userInput);
      button.textContent = checkedAddy;
      dropdown.classList.add('active');
      // lowerCaseAddy = checkedAddy.toLowerCase();
    } else if (addyInput.value === '' || addyInput.value.length < 42) {
      dropdown.classList.remove('active');
    }
  } catch (err) {
    console.log(err);
  }
});

// clicking the drop down will POST address input to server
// server returns X-axis and Y-axis data
let isGettingChartData = true;
document.addEventListener('click', (c) => {
  if (c.target.matches('#addy_input') || c.target.matches('.link')) {
    try {
      if (addyInput.value !== '' && addyInput.value.length === 42) {
        let userInput = addyInput.value;
        checkedAddy = ethers.utils.getAddress(userInput);
        button.textContent = checkedAddy;
        dropdown.classList.add('active');
        if (c.target.matches('.link') && isGettingChartData) {
          isGettingChartData = false;
          dropdown.classList.remove('active');
          lowerCaseAddy = checkedAddy.toLowerCase();
          requestData(lowerCaseAddy);
        }
      }
    } catch (err) {}
  } else {
    dropdown.classList.remove('active');
  }
});

const roundValue = (values) => {
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const difference = maxValue - minValue;
  const padding = difference * 0.05;
  const minY = Math.floor(minValue / padding - 1) * padding;
  const maxY = Math.ceil(maxValue / padding + 1) * padding;
  const small = minY / 10 ** (Math.trunc(minY).toString().length - 1);
  const roundedMinY = Math.round(small * 10) / 10;
  console.log(roundedMinY * 10 ** Math.trunc(minY).toString().length);
  return {maxY, minY};
};
const ctxx = document.getElementById('placeholder-chart');
const placeholder = new Chart(ctxx, {
  type: 'line',
  data: [1, 2, 3],
  options: {},
});

// function to post address to server
// response to receive are  X-axis and Y-axis data
let xLabels;
let yLabels;
const requestData = async (address) => {
  console.time('requesting data');
  const options = {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({address}),
  };
  const response = await fetch(`/api`, options);
  const data = await response.json();
  console.log(data.data);
  isGettingChartData = true;
  xLabels = Array.from(data.data.chart.dates).reverse();
  yLabels = Array.from(data.data.chart.values).reverse();
  let {maxY, minY} = roundValue(yLabels);
  document.getElementById('placeholder-chart').id = 'myChart';
  placeholder.destroy();
  const ctx = document.getElementById('myChart');
  const lineData = {
    labels: xLabels,
    datasets: [
      {
        // label: 'test',
        data: yLabels,
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          // 'rgba(54, 162, 235, 0.2)',
          // 'rgba(255, 206, 86, 0.2)',
          // 'rgba(75, 192, 192, 0.2)',
          // 'rgba(153, 102, 255, 0.2)',
          // 'rgba(255, 159, 64, 0.2)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          // 'rgba(54, 162, 235, 1)',
          // 'rgba(255, 206, 86, 1)',
          // 'rgba(75, 192, 192, 1)',
          // 'rgba(153, 102, 255, 1)',
          // 'rgba(255, 159, 64, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
  const lineOptions = {
    scales: {
      y: {
        beginAtZero: true,
        max: maxY,
        min: minY,
        grid: {
          drawBorder: true,
        },
      },
    },
    plugins: {
      title: {
        display: true,
        align: 'top',
        text: `${checkedAddy} $${Math.round(Math.max(...yLabels))}`,
        font: {
          size: 16,
        },
      },
      legend: {
        display: false,
      },
    },
    animation: {
      duration: 5000,
      loop: false,
    },
  };

  const myChart = new Chart(ctx, {
    type: 'line',
    data: lineData,
    options: lineOptions,
  });
  // const myChart = new Chart(ctx, {
  //   type: 'line',
  //   data: {
  //     labels: xLabels,
  //     datasets: [
  //       {
  //         label: 'test',
  //         data: yLabels,
  //         backgroundColor: [
  //           'rgba(255, 99, 132, 0.2)',
  //           'rgba(54, 162, 235, 0.2)',
  //           'rgba(255, 206, 86, 0.2)',
  //           'rgba(75, 192, 192, 0.2)',
  //           'rgba(153, 102, 255, 0.2)',
  //           'rgba(255, 159, 64, 0.2)',
  //         ],
  //         borderColor: [
  //           'rgba(255, 99, 132, 1)',
  //           'rgba(54, 162, 235, 1)',
  //           'rgba(255, 206, 86, 1)',
  //           'rgba(75, 192, 192, 1)',
  //           'rgba(153, 102, 255, 1)',
  //           'rgba(255, 159, 64, 1)',
  //         ],
  //         borderWidth: 1,
  //       },
  //     ],
  //   },
  //   options: {
  //     scales: {
  //       y: {
  //         beginAtZero: true,
  //         max: maxY,
  //         min: minY,
  //         grid: {
  //           drawBorder: true,
  //         },
  //       },
  //     },
  //     plugins: {
  //       title: {
  //         display: true,
  //         align: 'top',
  //         text: `$${Math.round(Math.max(...yLabels))}`,
  //         font: {
  //           size: 16,
  //         },
  //       },
  //       legend: {
  //         display: false,
  //       },
  //     },
  //     animation: {
  //       duration: 5000,
  //       loop: false,
  //     },
  //   },
  // });
  console.timeEnd('requesting data');
};
