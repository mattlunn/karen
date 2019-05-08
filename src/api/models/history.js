import moment from 'moment-timezone';

class Aggregate {
  constructor(start, end, data) {
    this.data = data;
    this.start = start.valueOf();
    this.end = end.valueOf();
  }

  min() {
    return this.data.length === 0 ? null : Math.min(...this.data.map(x => x.value));
  }

  max() {
    return this.data.length === 0 ? null : Math.max(...this.data.map(x => x.value));
  }

  average() {
    let total = 0;
    let count = 0;

    for (const row of this.data) {
      if (!row.end) {
        total += 1;
      } else {
        total += moment(row.end).diff(row.start, 'minutes')
      }

      count += row.value;
    }

    return total / count;
  }

  duration() {
    return this.data.reduce((acc, curr) => {
      return acc + moment(curr.end).diff(curr.start, 'seconds')
    }, 0);
  }
}

export default class History {
  constructor(data, { from, to }) {
    this.data = data;
    this.start = moment(from);
    this.end = moment(to);
  }

  *_createAggregates(aggregate) {
    let startOfAggregate = null;
    let endOfAggregate = moment(this.start);
    let startIndex = null;
    let endIndex = 0;

    do {
      startIndex = endIndex;
      startOfAggregate = endOfAggregate;
      endOfAggregate = moment.min(moment(startOfAggregate).add(aggregate), this.end);

      while (endIndex < this.data.length && moment(this.data[endIndex].start).isBefore(endOfAggregate)) {
        endIndex++;
      }

      yield new Aggregate(startOfAggregate, endOfAggregate, this.data.slice(startIndex, endIndex));
    } while (!endOfAggregate.isSame(this.end));
  }

  month() {
    return this._createAggregates(moment.duration(1, 'month'));
  }

  day() {
    return this._createAggregates(moment.duration(1, 'day'));
  }
}