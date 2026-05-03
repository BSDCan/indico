// This file is part of Indico.
// Copyright (C) 2002 - 2025 CERN
//
// Indico is free software; you can redistribute it and/or
// modify it under the terms of the MIT License; see the
// LICENSE file for more details.

import {nanoid} from 'nanoid';
import PropTypes from 'prop-types';
import React, {useState} from 'react';
import {useFormState} from 'react-final-form';
import {useSelector} from 'react-redux';
import {Button, Form, Label} from 'semantic-ui-react';

import {
  FinalCheckbox,
  FinalDropdown,
  FinalField,
  FinalInput,
  FinalTextArea,
  validators as v,
} from 'indico/react/forms';
import {FinalModalForm} from 'indico/react/forms/final-form';
import {Translate} from 'indico/react/i18n';

import {getPriceFormatter, getItems} from '../selectors';

import {PlacesLeft} from './PlacesLeftLabel';

import '../../../styles/regform.module.scss';

const PronounOptions = [
  '(do not display)',
  'he/him',
  'she/her',
  'they/them',
  "Other (please specify in the 'comments' box)",
];

const DietaryRestrictions = [
  'Vegetarian (no meat or fish)',
  'Vegan (no meat, fish, dairy, eggs, or animal products)',
  'Gluten-free (no wheat, barley, rye, or foods made from them)',
  "Other (please specify in the 'comments' box)",
];

const BeverageOptions = [
  'Caffeine-free beverages',
  'Sugar-free beverages',
  // Comment so that the linter allows this to be a list, not all one line.
];

const TShirtOptions = [
  'No t-shirt',
  'Small',
  'Medium',
  'Large',
  'XL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
  'Ladies Small',
  'Ladies Medium',
  'Ladies Large',
  'Ladies XL',
  'Ladies 2XL',
  'Ladies 3XL',
];

const ReceptionOptions = [
  'No',
  // BSDCAN: only enable one 'Yes' at once (after testing is finished)
  // 'Yes (free until May 1)',
  `Yes (cost $64)`,
  // Comment so that the linter allows this to be a list, not all one line.
];

function AccompanyingPersonModal({value, header, onSubmit, onClose}) {
  return (
    <FinalModalForm
      id="accompanyingperson-form"
      onSubmit={onSubmit}
      onClose={onClose}
      initialValues={value}
      header={header}
    >
      <FinalInput name="firstName" label={Translate.string('First Name')} required autoFocus />
      <FinalInput name="lastName" label={Translate.string('Last Name')} required />
      <FinalDropdown
        name="pronouns"
        label={Translate.string('Pronouns')}
        options={PronounOptions.map(pronoun => ({
          key: pronoun,
          value: pronoun,
          text: Translate.string(pronoun),
        }))}
        selection
        description="Optional, for nametags"
      />
      <FinalDropdown
        name="dietary"
        label={Translate.string('Dietary Restrictions')}
        options={DietaryRestrictions.map(dietary => ({
          key: dietary,
          value: dietary,
          text: Translate.string(dietary),
        }))}
        selection
        multiple
        description="You may select multiple"
      />
      <FinalDropdown
        name="beverage"
        label={Translate.string('Beverage Preference')}
        options={BeverageOptions.map(beverage => ({
          key: beverage,
          value: beverage,
          text: Translate.string(beverage),
        }))}
        selection
        multiple
        description="You may select multiple"
      />
      <FinalDropdown
        name="tshirt"
        label={Translate.string('T-shirt')}
        options={TShirtOptions.map(tshirt => ({
          key: tshirt,
          value: tshirt,
          text: Translate.string(tshirt),
        }))}
        selection
      />
      <FinalDropdown
        name="reception"
        label={Translate.string('Closing Reception')}
        options={ReceptionOptions.map(reception => ({
          key: reception,
          value: reception,
          text: Translate.string(reception),
        }))}
        selection
      />
      <FinalTextArea name="comments" label={Translate.string('Comments')} />
    </FinalModalForm>
  );
}

AccompanyingPersonModal.propTypes = {
  value: PropTypes.shape({
    id: PropTypes.string.isRequired,
    firstName: PropTypes.string.isRequired,
    lastName: PropTypes.string.isRequired,
    pronouns: PropTypes.string,
    dietary: PropTypes.array,
    beverage: PropTypes.array,
    tshirt: PropTypes.string,
    reception: PropTypes.string,
    comments: PropTypes.string,
  }),
  header: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

AccompanyingPersonModal.defaultProps = {
  value: {
    id: null,
    firstName: null,
    lastName: null,
    pronouns: null,
    dietary: null,
    beverage: null,
    tshirt: null,
    reception: null,
    comments: null,
  },
};

// Gather all accompanying persons field's counts.
function countAllAccompanyingPersons(items, formState) {
  const allAccompanyingPersonFieldNames = Object.values(items)
    .filter(f => f.inputType === 'accompanying_persons' && f.personsCountAgainstLimit)
    .map(apf => apf.htmlName);
  return allAccompanyingPersonFieldNames.reduce(
    (count, field) => count + formState.values[field]?.length || 0,
    0
  );
}

function calculatePlaces(availablePlaces, maxPersons, personsInCurrentField, items, formState) {
  if (availablePlaces === null) {
    // Field does not count towards registration limit...
    if (!maxPersons) {
      // ...and has no person limit.
      return [null, Infinity];
    } else {
      // ...and has a person limit.
      return [personsInCurrentField, maxPersons];
    }
  } else {
    // Field counts towards registration limit...
    const personsInAllFieldsCount = countAllAccompanyingPersons(items, formState);

    if (!maxPersons || maxPersons >= availablePlaces - personsInAllFieldsCount) {
      // ...and has no person limit, or its person limit is greater than the registration limit.
      return [personsInAllFieldsCount, availablePlaces];
    } else {
      // ...and has a person limit lower than the registration limit.
      return [personsInCurrentField, maxPersons];
    }
  }
}

function totalReceptionCost(value) {
  let totalCost = 0;
  for (let i = 0; i < value.length; i++) {
    const reception = value[i].reception;
    if (reception && reception.includes('Yes (cost')) {
      const cost = parseInt(reception.slice('Yes (cost $'.length, -1), 10);
      totalCost += cost;
    }
  }
  return totalCost;
}

function AccompanyingPersonsComponent({
  id,
  value,
  disabled,
  onChange,
  price,
  availablePlaces,
  maxPersons,
}) {
  const [operation, setOperation] = useState({type: null, person: null});
  const formatPrice = useSelector(getPriceFormatter);
  const totalPrice = (value.length * price + totalReceptionCost(value)).toFixed(2);
  const items = useSelector(getItems);
  const formState = useFormState();

  const [placesUsed, placesLimit] = calculatePlaces(
    availablePlaces,
    maxPersons,
    value.length,
    items,
    formState
  );

  const changeReducer = action => {
    switch (action.type) {
      case 'ADD':
        return [...value, {id: `new:${nanoid()}`, ...action.person}];
      case 'EDIT':
        return value.map(p => (p.id === action.person.id ? action.person : p));
      case 'REMOVE':
        return value.filter(p => p.id !== action.id);
    }
  };

  const handleAccompanyingPersonAdd = () => {
    setOperation({type: 'ADD', person: null});
  };

  const handleAccompanyingPersonEdit = personId => {
    setOperation({type: 'EDIT', person: value.find(p => p.id === personId)});
  };

  const handleAccompanyingPersonRemove = personId => {
    onChange(changeReducer({type: 'REMOVE', id: personId}));
  };

  const handleModalClose = () => {
    setOperation({type: null, person: null});
  };

  return (
    <Form.Group styleName="accompanyingpersons-field">
      <ul>
        {!value.length && (
          <li styleName="light">
            <Translate>No accompanying persons registered</Translate>
          </li>
        )}
        {value.map(person => (
          <li key={person.id}>
            <span>
              {person.firstName} {person.lastName}
            </span>
            <span style={{marginLeft: '2em'}}>
              {person.pronouns !== undefined && `(${person.pronouns}) | `}
              {person.dietary !== undefined && `${person.dietary.join(', ')} | `}
              {person.beverage !== undefined && `${person.beverage.join(', ')} | `}
              {person.tshirt !== undefined && `${person.tshirt} | `}
              {person.reception !== undefined && `${person.reception} | `}
              {person.comments !== undefined && `${person.comments}`}
            </span>
            <div styleName="actions">
              <a
                className="icon-edit"
                title={Translate.string('Edit this person')}
                onClick={() => handleAccompanyingPersonEdit(person.id)}
              />
              <a
                className="icon-remove"
                title={Translate.string('Remove this person')}
                onClick={() => handleAccompanyingPersonRemove(person.id)}
              />
            </div>
          </li>
        ))}
      </ul>
      <div styleName="summary">
        <Button
          size="small"
          type="button"
          onClick={handleAccompanyingPersonAdd}
          disabled={disabled || placesLimit - placesUsed === 0}
          aria-describedby={id ? `${id}-placeslimit` : ''}
        >
          <Translate>Add accompanying person</Translate>
        </Button>
        {!!price && (
          <Label basic pointing="left" styleName="price-tag" size="small">
            {formatPrice(price)} (Total: {formatPrice(totalPrice)})
          </Label>
        )}
        {placesLimit !== Infinity && (
          <div id={`${id}-placeslimit`} styleName="places-left">
            <PlacesLeft placesLimit={placesLimit} placesUsed={placesUsed} isEnabled={!disabled} />
          </div>
        )}
      </div>
      {['ADD', 'EDIT'].includes(operation.type) && (
        <AccompanyingPersonModal
          header={
            operation.type === 'EDIT'
              ? Translate.string('Edit accompanying person')
              : Translate.string('Add accompanying person')
          }
          onSubmit={formData => {
            onChange(changeReducer({type: operation.type, person: formData}));
            handleModalClose();
          }}
          value={operation.person}
          onClose={handleModalClose}
        />
      )}
    </Form.Group>
  );
}

AccompanyingPersonsComponent.propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      firstName: PropTypes.string.isRequired,
      lastName: PropTypes.string.isRequired,
      pronouns: PropTypes.string,
      dietary: PropTypes.array,
      beverage: PropTypes.array,
      tshirt: PropTypes.string,
      reception: PropTypes.string,
      comments: PropTypes.string,
    })
  ).isRequired,
  disabled: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  price: PropTypes.number,
  availablePlaces: PropTypes.number,
  maxPersons: PropTypes.number,
};

AccompanyingPersonsComponent.defaultProps = {
  disabled: false,
  price: 0,
  availablePlaces: null,
  maxPersons: null,
};

export default function AccompanyingPersonsInput({
  htmlId,
  htmlName,
  disabled,
  price,
  availablePlaces,
  maxPersons,
}) {
  return (
    <FinalField
      id={htmlId}
      name={htmlName}
      component={AccompanyingPersonsComponent}
      disabled={disabled}
      price={price}
      availablePlaces={availablePlaces}
      maxPersons={maxPersons}
    />
  );
}

AccompanyingPersonsInput.propTypes = {
  htmlId: PropTypes.string.isRequired,
  htmlName: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  price: PropTypes.number,
  availablePlaces: PropTypes.number,
  maxPersons: PropTypes.number,
};

AccompanyingPersonsInput.defaultProps = {
  disabled: false,
  price: 0,
  availablePlaces: null,
  maxPersons: null,
};

export const accompanyingPersonsSettingsInitialData = {
  maxPersons: 1,
  personsCountAgainstLimit: false,
};

export function AccompanyingPersonsSettings() {
  return (
    <>
      <FinalInput
        name="maxPersons"
        type="number"
        label={Translate.string('Maximum per registrant')}
        placeholder={Translate.string('No maximum')}
        step="1"
        min="0"
        validate={v.optional(v.min(0))}
        fluid
        format={val => val || ''}
        parse={val => +val || 0}
      />
      <FinalCheckbox
        name="personsCountAgainstLimit"
        label={Translate.string('Accompanying persons count against registration limit')}
      />
    </>
  );
}
