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
        total += moment(row.end).diff(row.start, 'minutes');
      }

      count += row.value;
    }

    return total / count;
  }

  duration() {
    return this.data.reduce((acc, curr) => {
      return acc + moment(curr.end).diff(curr.start, 'seconds');
    }, 0);
  }
}

class Datum {
  constructor(data) {
    this.period = {
      start: +data.start,
      end: +data.end
    };

    this.value = data.value;
  }
}

export default class History {
  constructor(data, { from, to }) {
    this._data = data;
    this._start = moment(from);
    this._end = moment(to);
  }

  *_createAggregates(aggregate) {
    let startOfAggregate = null;
    let endOfAggregate = moment(this._start);
    let startIndex = null;
    let endIndex = 0;

    do {
      startIndex = endIndex;
      startOfAggregate = endOfAggregate;
      endOfAggregate = moment.min(moment(startOfAggregate).add(aggregate), this._end);

      while (endIndex < this._data.length && moment(this._data[endIndex].start).isBefore(endOfAggregate)) {
        endIndex++;
      }

      yield new Aggregate(startOfAggregate, endOfAggregate, this._data.slice(startIndex, endIndex));
    } while (!endOfAggregate.isSame(this._end));
  }

  month() {
    return this._createAggregates(moment.duration(1, 'month'));
  }

  day() {
    return this._createAggregates(moment.duration(1, 'day'));
  }

  data() {
    return this._data.map(datum => new Datum(datum));
  }
}